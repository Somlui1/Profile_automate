class ApplicationError(Exception):
    """Base application exception."""
    message: str = "An unexpected error occurred."
    
    def __init__(self, message: str = None):
        if message:
            self.message = message
        super().__init__(self.message)

class PDFParsingError(ApplicationError):
    """Raised when PDF text extraction or parsing fails."""
    pass

class PDFValidationError(ApplicationError):
    """Raised when the PDF structure does not match the expected template."""
    pass

class ActiveDirectoryError(ApplicationError):
    """Raised when operations against Active Directory fail."""
    pass

class PapercutAPIError(ApplicationError):
    """Raised when operations against the Papercut API fail."""
    pass

class PreflightError(ApplicationError):
    """Raised when preflight health check fails."""
    pass

class M365UserNotSyncedError(ApplicationError):
    """Raised when user has not been synced to Azure AD yet."""
    pass
