import os
from typing import List
from dotenv import load_dotenv

# Load settings from worker/.env
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(base_dir, ".env")
load_dotenv(dotenv_path=env_path)

class Settings:
    # FastAPI Server
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Active Directory / LDAP
    # AD_HOSTS supports comma-separated list of Domain Controller IPs for failover
    # e.g. "10.10.10.253,10.10.10.250"
    AD_HOSTS_RAW: str = os.getenv("AD_HOSTS", "")
    AD_USER: str = os.getenv("AD_USER", "")
    AD_PASSWORD: str = os.getenv("AD_PASSWORD", "")
    AD_BASE_DN: str = os.getenv("AD_BASE_DN", "DC=aapico,DC=com")
    AD_NEW_HIRE_OU: str = os.getenv("AD_NEW_HIRE_OU", "")
    AD_CONTRACT_OU: str = os.getenv("AD_CONTRACT_OU", "")

    @property
    def AD_HOSTS(self) -> List[str]:
        """Parse comma-separated AD_HOSTS into a list of host addresses."""
        if not self.AD_HOSTS_RAW:
            return []
        return [h.strip() for h in self.AD_HOSTS_RAW.split(",") if h.strip()]

    # --- Legacy aliases (backward compat) ---
    @property
    def LDAP_SERVER(self) -> str:
        return self.AD_HOSTS[0] if self.AD_HOSTS else ""

    @property
    def LDAP_USER(self) -> str:
        return self.AD_USER

    @property
    def LDAP_PASSWORD(self) -> str:
        return self.AD_PASSWORD

    @property
    def LDAP_BASE_DN(self) -> str:
        return self.AD_BASE_DN

    @property
    def LDAP_NEW_HIRE_OU(self) -> str:
        return self.AD_NEW_HIRE_OU

    @property
    def LDAP_CONTRACT_OU(self) -> str:
        return self.AD_CONTRACT_OU

    # Papercut API
    PAPERCUT_API_URL: str = os.getenv("PAPERCUT_API_URL", "")
    PAPERCUT_API_KEY: str = os.getenv("PAPERCUT_API_KEY", "")

    # Microsoft Graph API
    M365_TENANT_ID: str = os.getenv("M365_TENANT_ID", "a4722e58-ec99-4c3b-a34c-38620f1c4288")
    M365_CLIENT_ID: str = os.getenv("M365_CLIENT_ID", "ec1e5f36-4262-4ead-a5d7-9ab8892a950b")
    M365_CLIENT_SECRET: str = os.getenv("M365_CLIENT_SECRET", "")
    
    # Redis Configuration
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")

    # Job Configuration
    JOB_LOG_RETENTION_DAYS: int = int(os.getenv("JOB_LOG_RETENTION_DAYS", "30"))
    JOB_CANCEL_ROLLBACK_AD: bool = os.getenv("JOB_CANCEL_ROLLBACK_AD", "true").lower() == "true"
    
    # Database Configuration
    DB_PATH: str = os.getenv("DB_PATH", os.path.abspath(os.path.join(base_dir, "data", "jobs.db")))
    
    # Debug Mode
    DEBUG_MODE: bool = os.getenv("DEBUG_MODE", "true").lower() == "true"

settings = Settings()
