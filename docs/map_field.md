{
  "active_directory_mapping": {
    "1_general": {
      "first_name": "requester_info.name_english -> extract_first_name()",
      "initials": "",
      "last_name": "requester_info.name_english -> extract_last_name()",
      "display_name": "requester_info.name_english + ' (' + requester_info.company + ')'",
      "description": "requester_info.employee_id",
      "office": "requester_info.company",
      "telephone_number": "'035-350880 ext.' + requester_info.ext",
      "telephone_number_other": "",
      "email": "generate_username(requester_info.name_english) + '@' + requester_info.company.toLowerCase() + '.com'",
      "web_page": ""
    },
    "2_address": {
      "street": "",
      "po_box": "",
      "city": "Ban Len, Bang pa-in",
      "state_province": "Phranakhon Sri Ayutthaya",
      "zip_postal_code": "13160",
      "country_region": "Thailand"
    },
    "3_account": {
      "user_logon_name_upn": "generate_username(requester_info.name_english) + '@aapico.com'",
      "user_logon_name_pre_windows_2000": "generate_username(requester_info.name_english)",
      "logon_hours": "Custom Restrictions Applied (Configured)",
      "logon_to": "All Computers",
      "account_options": {
        "user_must_change_password_at_next_logon": true,
        "user_cannot_change_password": false,
        "password_never_expires": false,
        "store_password_using_reversible_enc": false,
        "account_is_disabled": false
      },
      "account_expires": ""
    },
    "4_profile": {
      "profile_path": "",
      "logon_script": "",
      "home_folder_local_path": ""
    },
    "5_telephones": {
      "home": "",
      "pager": "",
      "mobile": "requester_info.mobile_phone",
      "fax": "",
      "ip_phone": "",
      "notes": ""
    },
    "6_organization": {
      "title": "requester_info.position",
      "department": "requester_info.department",
      "company": "requester_info.company",
      "manager": "requester_info.supervisor_name"
    },
    "7_member_of": [],
    "8_attribute_editor": {}
  }
}