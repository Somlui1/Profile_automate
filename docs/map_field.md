# Field Mapping and Transformation Pipeline

This document defines the data transformation pipeline for the PDF Auto Provisioning process, transitioning from **Step 1: Upload & Extract (Raw PDF Output)** to **Step 2: Verify & Edit Fields**, and finally to the **Final API Payload (Step 3)**.

## 1. Raw Data Extraction (Input: Raw Output.json)
This is the base data extracted from the PDF:

```json
{
    "document_info": {
        "date": "29/05/26",
        "doc_no": "EF-26050174-B3"
    },
    "requester_info": {
        "company": "AAPICO Amata",
        "name_thai": "นางสาววนิดา ศรีใส",
        "name_english": "Ms. Wanida Srisai",
        "employee_id": "10003083",
        "position": "HR Specialist",
        "department_group": "Human Resources",
        "department": "Human Resources",
        "ext": "3388",
        "mobile_phone": "(081) 999-XXXX",
        "supervisor_name": "Mr. Somchai",
        "supervisor_position": "HR Manager",
        "address": "Ban Len, Bang pa-in",
        "zip_code": "13160",
        "internet": {
            "level": "LevelB"
        },
        "printer": {
            "type": "Black-White"
        }
    }
}
```

## 2. AD Mapped Preview (Mapping Rules & Logic)
Generate the `AD Mapped Preview` JSON based strictly on these transformation rules:

* **general_information:**
    * `firstName`: Extract the first name from `name_english` (Remove "Mr."/"Ms.").
    * `lastName`: Extract the last name from `name_english`.
    * `displayName`: Combine the cleaned name and company (e.g., "Wanida Srisai (AAPICO Amata)").
    * `description`: Map to `employee_id`.
    * `email`: Format as `<firstName_lowercase>.<first_letter_of_lastName_lowercase>@aapico.com`.
    * `usernameLogon`: Format as `<firstName_lowercase>.<first_letter_of_lastName_lowercase>`.
    * `userPassword`: Constant value `"P@ssw0rd$"`.
    * `office`: Map to `company`.
    * `phone`: Leave as `{To be specified in Step 2}`.
* **organizational_unit & microsoft_365_licenses:**
    * All nested values: Leave as `{To be specified in Step 2}`.
* **address_details:**
    * `addressStreet`: `""`
    * `addressCity`: `"Ban Len, Bang pa-in"`
    * `addressState`: `"Phranakhon Sri Ayutthaya"`
    * `addressZip`: `"13160"`
    * `addressCountry`: Constant value `"Thailand"`.
* **organization_details:**
    * Map directly from `requester_info` (`company`, `department`, `jobTitle` <- `position`, `managerInput` <- `supervisor_name`).
* **ad_security_groups:**
    * `groupTableBody`: Apply these conditional rules:
        * *Internet Group:* If `request_info.internet.level` exists, add the group formatted as `"User_" + level + "_AH"` (e.g., `User_LevelB_AH`).
        * *Printer Group:* If `request_info.printer.type` equals `"Black-White"` or `"B/W print"`, add the group `"BW200"`. Otherwise, leave as `{To be specified in Step 2}`.
* **account_configuration:**
    * `mobile`: Map to `mobile_phone`.
    * `printCode`: If `printer.type` equals `"Black-White"` or `"B/W print"`, auto-fill with the last 6 digits of `requester_info.mobile_phone`.
    * `profilePath` & `logonScript`: Leave as `{To be specified in Step 2}`.
    * `pwdResetCheckbox` & `accountEnabledCheckbox`: Constant boolean `true`.
* **welcome_email_preview:**
    * `email-to`: Perform an API search for `supervisor_name` to get their logon username, then format as `<supervisor_username>@aapico.com` (e.g., `wajeepradit.p@aapico.com`).
    * `email-cc`: Constant value `"itsupport@aapico.com"`.
    * `email-subject`: `"Automated Template Subject"`
    * `email-body`: `"Automated Template Body"`

## 3. Final API Payload (Step 2 -> Step 3)
After user verification and edits in Step 2, the data is collected and packaged into the Final API Payload for automated sequence dispatch:

```json
{
    "metadata": {
        "document_info": {
            "date": "29/05/26",
            "doc_no": "EF-26050174-B3"
        },
        "requester_info": {
            "company": "AAPICO Amata",
            "name_thai": "นางสาววนิดา ศรีใส",
            "name_english": "Wanida Srisai",
            "employee_id": "10003083",
            "position": "HR Specialist",
            "department_group": "Human Resources",
            "department": "Human Resources",
            "ext": "3388",
            "mobile_phone": "(081) 999-XXXX",
            "supervisor_name": "Mr. Somchai",
            "supervisor_position": "HR Manager",
            "address": "Ban Len, Bang pa-in",
            "zip_code": "13160"
        }
    },
    "workflow_control": {
        "enable_ad_creation": true,
        "enable_papercut_sync": true,
        "enable_microsoft_365_license": true,
        "enable_send_email": true
    },
    "task_data": {
        "ad_profile": {
            "custom_username": "wanida.s",
            "target_ou": "OU=newhire,OU=Users,DC=aapico,DC=com",
            "custom_attributes": {
                "first_name": "Wanida",
                "last_name": "Srisai",
                "display_name": "Wanida Srisai (AAPICO Amata)",
                "description": "10003083",
                "office": "AAPICO Amata",
                "telephone_number": "{To be specified in Step 2}",
                "email": "wanida.s@aapico.com",
                "mobile": "(081) 999-XXXX",
                "title": "HR Specialist",
                "department": "Human Resources",
                "company": "AAPICO Amata",
                "manager": "Mr. Somchai",
                "street": "",
                "city": "Ban Len, Bang pa-in",
                "state_province": "Phranakhon Sri Ayutthaya",
                "zip_postal_code": "13160",
                "country_region": "Thailand",
                "profile_path": "{To be specified in Step 2}",
                "logon_script": "{To be specified in Step 2}",
                "change_password_next_logon": true,
                "account_disabled": false,
                "password": "P@ssw0rd$",
                "user_principal_name": "wanida.s@aapico.com"
            }
        },
        "papercut_profile": {
            "print_code": "99XXXX"
        },
        "microsoft_365_licenses": {
            "SkuId_id": [
                {
                    "skuId": "a4722e58-ec99-4c3b-a34c-38620f1c4288",
                    "skuPartNumber": "STANDARDPACK"
                }
            ]
        },
        "email_profile": {
            "emailSubject": "Automated Template Subject",
            "emailTo": "somchai.m@aapico.com",
            "emailCc": "itsupport@aapico.com",
            "emailBody": "Automated Template Body"
        }
    }
}
```