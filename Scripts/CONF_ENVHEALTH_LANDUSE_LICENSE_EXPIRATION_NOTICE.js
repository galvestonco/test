{
	"EnvHealth/Land Use/*/Permit": {
		"45 Day Notice": {
			"notificationTemplate": "SS_PERMIT_ABOUT_TO_EXPIRE",
			"notificationReport": false,
			"notifyContactTypes": "Property Owner",
			"mailerSetType": "Renewal",
			"mailerSetStatus": "Open",
			"mailerSetPrefix": "SEPTIC_LIC_ABOUT_TO_EXPIRE", 
			"updateExpirationStatus": "About to Expire",
			"updateRecordStatus": false,
			"updateWorkflowTask": false,
			"updateWorkflowStatus": false,
			"nextNotificationDays": 45,
			"nextNotification": "Expiration Notice"
		},
		"Expiration Notice": {
			"notificationTemplate": "SS_PERMIT_EXPIRATION_FINAL_NOTICE",
			"notificationReport": false,
			"notifyContactTypes": "Applicant, Accounts Receivable",
			"mailerSetType": "Renewal",
			"mailerSetStatus": "Open",
			"mailerSetPrefix": "LIC_EXPIRATION_FINAL_NOTICE",
			"updateExpirationStatus": "Expired",
			"updateRecordStatus": "Expired",
			"updateWorkflowTask": false,
			"updateWorkflowStatus": false,
			"nextNotificationDays": false,
			"nextNotification": false,
			"inspectionType": false,
			"scheduleOutDays": false,
			"cancelAllInspections":true
			
           
		}
	}
}