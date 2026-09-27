import logging
from typing import Any, Dict

class CorrelationFilter(logging.Filter):
    def __init__(self):
        super().__init__()
        self.job_id = "unknown"
        self.submission_id = "unknown"

    def filter(self, record: logging.LogRecord) -> bool:
        record.job_id = self.job_id
        record.submission_id = self.submission_id
        return True

# Initialize a global filter instance to be updated by context
correlation_filter = CorrelationFilter()

def setup_logging():
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    # Remove all handlers to avoid duplicates
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)

    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - [job:%(job_id)s] [sub:%(submission_id)s] - %(message)s'
    )
    handler.setFormatter(formatter)
    handler.addFilter(correlation_filter)
    logger.addHandler(handler)

def set_correlation_context(job_id: str, submission_id: str):
    correlation_filter.job_id = job_id
    correlation_filter.submission_id = submission_id
