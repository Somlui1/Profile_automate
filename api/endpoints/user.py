from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import logging
from services.ad_service import ad_service
from services.papercut_service import papercut_service
from core.exceptions import ActiveDirectoryError, PapercutAPIError

router = APIRouter()
logger = logging.getLogger("app.api.user")

class BulkGroupCheckRequest(BaseModel):
    groups: List[str]

class DocumentInfoSchema(BaseModel):
    date: str
    doc_no: str

class RequesterInfoSchema(BaseModel):
    company: str
    name_thai: str
    name_english: str
    employee_id: str
    position: str
    department_group: str
    department: str
    ext: str
    mobile_phone: str
    supervisor_name: str
    supervisor_position: str
    address: str
    zip_code: str

class WorkflowControlSchema(BaseModel):
    enable_ad_creation: bool = True
    enable_papercut_sync: bool = True
    enable_microsoft_365_license: bool = True
    enable_send_email: bool = True

class ADProfileSchema(BaseModel):
    custom_username: str
    target_ou: str
    custom_attributes: Dict[str, Any]

class PapercutProfileSchema(BaseModel):
    print_code: str

class Microsoft365License(BaseModel):
    skuId: str
    skuPartNumber: str

class Microsoft365LicensesSchema(BaseModel):
    SkuId_id: List[Microsoft365License]

class EmailProfileSchema(BaseModel):
    emailSubject: str
    emailTo: str
    emailCc: str
    emailBody: str

class TaskDataSchema(BaseModel):
    ad_profile: ADProfileSchema
    papercut_profile: PapercutProfileSchema
    microsoft_365_licenses: Optional[Microsoft365LicensesSchema] = None
    email_profile: Optional[EmailProfileSchema] = None

class MetadataSchema(BaseModel):
    document_info: DocumentInfoSchema
    requester_info: RequesterInfoSchema

class UserSyncRequest(BaseModel):
    metadata: MetadataSchema
    workflow_control: WorkflowControlSchema
    task_data: TaskDataSchema

@router.get("/ad/check-user", status_code=status.HTTP_200_OK)
def check_user(query: str, exact: bool = False):
    """
    Check if a user exists in Active Directory.
    exact=true: Check exact sAMAccountName (username logon check)
    exact=false: Check name/displayName/sAMAccountName (manager check)
    """
    try:
        exists, username = ad_service.check_user_exists_with_username(query, exact)
        return {"exists": exists, "username": username}
    except ActiveDirectoryError as ae:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Active Directory Query Failed: {str(ae)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )

@router.get("/ad/details", status_code=status.HTTP_200_OK)
def get_user_details(dn: str):
    """
    Get detailed attributes of a user in Active Directory.
    """
    try:
        details = ad_service.get_user_details(dn)
        if not details:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with DN '{dn}' not found in Active Directory."
            )
        return details
    except ActiveDirectoryError as ae:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Active Directory Query Failed: {str(ae)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )

@router.get("/ou/search", status_code=status.HTTP_200_OK)
def search_ous(query: Optional[str] = None):
    """
    Search Organizational Units in Active Directory.
    """
    try:
        ous = ad_service.search_ous(query or "")
        return {"ous": ous}
    except ActiveDirectoryError as ae:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Active Directory Query Failed: {str(ae)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during OU search: {str(e)}"
        )

@router.get("/groups/search", status_code=status.HTTP_200_OK)
def search_groups(query: Optional[str] = None):
    """
    Search Security Groups in Active Directory.
    """
    try:
        groups = ad_service.search_groups(query or "")
        return {"groups": groups}
    except ActiveDirectoryError as ae:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Active Directory Query Failed: {str(ae)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during group search: {str(e)}"
        )

@router.post("/groups/bulk-check", status_code=status.HTTP_200_OK)
def bulk_check_groups(payload: BulkGroupCheckRequest):
    """
    Check multiple Security Groups in Active Directory (Exact Match).
    """
    try:
        results = ad_service.bulk_check_groups(payload.groups)
        return {"results": results}
    except ActiveDirectoryError as ae:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Active Directory Query Failed: {str(ae)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during bulk group check: {str(e)}"
        )

@router.get("/ad/tree", status_code=status.HTTP_200_OK)
def get_ad_tree(parent_dn: Optional[str] = None):
    """
    Get immediate children of a given DN in Active Directory tree.
    """
    try:
        nodes = ad_service.get_ad_tree(parent_dn)
        return {
            "nodes": nodes,
            "base_dn": ad_service.base_dn
        }
    except ActiveDirectoryError as ae:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Active Directory Query Failed: {str(ae)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during AD tree query: {str(e)}"
        )

@router.post("/sync", status_code=status.HTTP_200_OK)
def sync_user(payload: UserSyncRequest):
    """
    Submit the verified user details to create the AD account and configure Papercut printing.
    """
    req_info = payload.requester_info
    
    # 1. Determine sAMAccountName (username)
    username = payload.custom_username
    if not username:
        # Generate username from English name (e.g. "Mr. Kroeksak Mon-in" -> "kroeksak.m")
        clean_name = req_info.name_english.replace("Mr. ", "").replace("Ms. ", "").replace("Mrs. ", "").strip().lower()
        parts = clean_name.split()
        if len(parts) >= 2:
            username = f"{parts[0]}.{parts[1][0]}"
        elif len(parts) == 1:
            username = parts[0]
        else:
            username = f"user.{req_info.employee_id}"
            
    # 2. Determine print code (PIN)
    print_code = payload.custom_print_code
    if not print_code:
        # Use employee ID as print code if not custom provided
        print_code = req_info.employee_id
        
    logger.info(f"Received request to sync user: {username} (Employee ID: {req_info.employee_id})")
    
    # Structure user details for AD service
    ad_user_details = {
        "username": username,
        "email": f"{username}@{req_info.company.lower() if req_info.company else 'company'}.com",
        "name_english": req_info.name_english,
        "company": req_info.company,
        "employee_id": req_info.employee_id,
        "position": req_info.position,
        "department": req_info.department,
        "ext": req_info.ext,
        "mobile_phone": req_info.mobile_phone,
        "supervisor_name": req_info.supervisor_name,
        "custom_attributes": payload.custom_attributes or {}
    }
    
    ad_status = "Skipped (Exists)"
    papercut_status = "Pending"
    ad_dn = ""
    
    try:
        # 3. Check if user already exists in Active Directory
        user_exists = ad_service.check_user_exists(username)
        
        if not user_exists:
            # 4. Create user in Active Directory
            success, ad_dn = ad_service.create_user(
                ad_user_details, 
                is_contractor=payload.is_contractor,
                target_ou=payload.target_ou
            )
            ad_status = "Success" if success else "Failed"
        else:
            ad_status = "Exists (Checked)"
            ad_dn = f"CN={req_info.name_english},{payload.target_ou or 'OU=newhire,OU=Users,DC=aapico,DC=com'}"
            
        # 5. Sync user in Papercut (even if user existed, we update printing PIN)
        try:
            # Push new user into Papercut (or pull from AD)
            papercut_service.sync_user_from_ad(username)
            
            # Set the user print card PIN code
            pin_success = papercut_service.set_user_print_code(username, print_code)
            papercut_status = "Success" if pin_success else "No Code Set"
            
        except PapercutAPIError as pe:
            papercut_status = f"Failed: {str(pe)}"
            
    except ActiveDirectoryError as ae:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Active Directory Operation Failed: {str(ae)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during syncing: {str(e)}"
        )
        
    # Get the display target OU
    result_ou = payload.target_ou or ("OU=contract" if payload.is_contractor else "OU=newhire")
    if result_ou and "," in result_ou:
        result_ou = result_ou.split(",")[0]  # Just get the first OU name for simpler display (e.g. OU=Engineering)

    return {
        "username": username,
        "print_code": print_code,
        "active_directory": {
            "status": ad_status,
            "distinguished_name": ad_dn,
            "ou": result_ou
        },
        "papercut": {
            "status": papercut_status
        }
    }
