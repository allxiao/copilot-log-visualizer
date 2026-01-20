import json
from datetime import datetime, timezone
from mitmproxy import http


def format_timestamp(ts: float) -> str:
    """Format a timestamp float into an ISO 8601 string."""
    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
    return dt.isoformat()


def response(flow: http.HTTPFlow):
    """
    This function runs for every HTTP flow that has a response.
    It extracts details and prints a single-line JSON object.
    """

    # helper function to safely get dictionary from headers
    def headers_to_dict(headers):
        return {k: v for k, v in headers.items()}

    # Construct the dictionary object
    record = {
        "timestamp": format_timestamp(flow.request.timestamp_start),
        "completed": format_timestamp(flow.response.timestamp_end) if (flow.response and flow.response.timestamp_end) else None,
        "url": flow.request.pretty_url,
        "method": flow.request.method,
        "status_code": flow.response.status_code if flow.response else None,
        "request": {
            "headers": headers_to_dict(flow.request.headers),
            # get_text(strict=False) attempts to decode bytes to string (handling gzip/utf-8)
            "body": flow.request.get_text(strict=False)
        },
        "response": {
            "headers": headers_to_dict(flow.response.headers if flow.response else {}),
            "body": flow.response.get_text(strict=False) if flow.response else ""
        }
    }

    # Dump to JSON string (ensure_ascii=False allows special characters to remain readable)
    print(json.dumps(record, ensure_ascii=False), flush=True)
