import { Injectable } from '@nestjs/common';

interface LogEntry {
  timestamp: string;
  completed?: string;
  url: string;
  method: string;
  status_code: number;
  request: {
    headers: Record<string, string>;
    body: string;
  };
  response: {
    headers: Record<string, string>;
    body: string;
  };
}

export interface ParsedRequest {
  id: string;
  timestamp: string;
  completed?: string;
  duration: number;
  method: string;
  url: string;
  status: number;
  request: {
    headers: Record<string, string>;
    body: any;
  };
  response: {
    headers: Record<string, string>;
    body: any;
  };
}

@Injectable()
export class LogService {
  parseLogs(content: string): ParsedRequest[] {
    const lines = content.trim().split('\n');
    const entries: LogEntry[] = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        entries.push(entry);
      } catch (error) {
        console.error('Failed to parse line:', error);
      }
    }

    const requestMap = new Map<string, ParsedRequest>();

    for (const entry of entries) {
      const requestId = `${entry.timestamp}-${entry.url}`;
      
      if (!requestMap.has(requestId)) {
        const duration = entry.completed 
          ? new Date(entry.completed).getTime() - new Date(entry.timestamp).getTime()
          : 0;

        let requestBody: any = entry.request.body;
        try {
          requestBody = JSON.parse(entry.request.body);
        } catch {
          // keep as string
        }

        let responseBody: any = entry.response.body;
        
        if (responseBody && responseBody.startsWith('event:')) {
          responseBody = this.parseSSE(responseBody);
        } else {
          try {
            responseBody = JSON.parse(responseBody);
          } catch {
            // keep as string
          }
        }

        requestMap.set(requestId, {
          id: requestId,
          timestamp: entry.timestamp,
          completed: entry.completed,
          duration,
          method: entry.method,
          url: entry.url,
          status: entry.status_code,
          request: {
            headers: entry.request.headers,
            body: requestBody,
          },
          response: {
            headers: entry.response.headers,
            body: responseBody,
          },
        });
      } else {
        const existing = requestMap.get(requestId);
        if (entry.response && entry.response.body) {
          let responseBody: any = entry.response.body;
          
          if (responseBody.startsWith('event:')) {
            const parsedSSE = this.parseSSE(responseBody);
            if (Array.isArray(existing.response.body)) {
              existing.response.body.push(...parsedSSE);
            } else {
              existing.response.body = [existing.response.body, ...parsedSSE];
            }
          } else {
            try {
              responseBody = JSON.parse(responseBody);
              if (Array.isArray(existing.response.body)) {
                existing.response.body.push(responseBody);
              } else {
                existing.response.body = [existing.response.body, responseBody];
              }
            } catch {
              // keep as string
            }
          }
        }
      }
    }

    return Array.from(requestMap.values()).sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  private parseSSE(sseData: string): any[] {
    const events = [];
    const lines = sseData.split('\n');
    let currentEvent: any = {};

    for (const line of lines) {
      if (line.startsWith('event:')) {
        currentEvent.event = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        const dataStr = line.substring(5).trim();
        try {
          currentEvent.data = JSON.parse(dataStr);
        } catch {
          currentEvent.data = dataStr;
        }
        events.push(currentEvent);
        currentEvent = {};
      }
    }

    return events;
  }
}
