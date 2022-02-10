/**
 * INCLUDES_NOTIFICATIONS
 * 	- this object is used to read any Accela records. Additional utility functions included.
 * @module INCLUDES_NOTIFICATIONS
 * @namespace INCLUDES_NOTIFICATIONS
 * Dependencies:
 * INCLUDES_BATCHBASE
 */
/**
 * processBatchNotification
 * 
 * @param {*} recordIdObjectArray 
 * @param {*} noticeConfScriptName 
 */
function processBatchNotification(recordIdObjectArray, searchRules, noticeRules) {

    try {

        // setup variables for stats
        // main loop
		logDebug('running local includes_notification');
        var statFilterType = 0
        var statFilterInactive = 0;
        var statFilterError = 0;
        var statFilterStatus = 0;
        var statDeactivated = 0;
        var statExceptions = 0;
        var statTotalCount = 0 + recordIdObjectArray.length;
        var statProcessedCount = 0;
        var statMailerSetCount = 0;

        // prep variables for search rules - for additional filtering and notification params
        var firstNotice = searchRules.firstNotice;
        var excludeRecordsArray = searchRules.excludeRecordType;
        var excludeRecordStatusArray = searchRules.excludeRecordStatus;
        var adminEmail = searchRules.adminEmail;
		var batchJobName = aa.env.getValue("BatchJobName") ; 
		if(  isEmptyOrNull(adminEmail) &&  !isEmptyOrNull(batchJobName) ) 
		{
			
	var batchEngineObj =  aa.proxyInvoker.newInstance("com.accela.v360.batchjob.BatchEngineBusiness");
    if(batchEngineObj.getSuccess())
	{
		var agencyName =  aa.getServiceProviderCode() ;
		logDebug("agencyName:" +agencyName  + " batchJobName:" +batchJobName ) ;
		var batchJob = batchEngineObj.getOutput().getBatchJobByName(agencyName ,batchJobName)  ;
		if( batchJob != null )
			{
			var jobEmailID = batchJob.getEmailID();
			logDebug("fetch email from job details:" +jobEmailID)
			if(!isEmptyOrNull(jobEmailID)) 
			{
				adminEmail =jobEmailID 
			}
			}
	  }
		}
        var batchResultEmailTemplate = searchRules.batchResultEmailTemplate;
        var agencyReplyEmail = lookup("ACA_EMAIL_TO_AND_FROM_SETTING", "RENEW_LICENSE_AUTO_ISSUANCE_MAILFROM");
        var acaURL = lookup("ACA_CONFIGS", "ACA_SITE");
        acaURL = acaURL.substr(0, acaURL.toUpperCase().indexOf("/ADMIN"));

        /******
         * TO DO: 
         * 		1) ADD JSON PARAMETERS FOR RECORD TYPE AND STATUS
         * 		2) BUILD CAP MODEL TO USE IN SEARCH
         */

        logDebug("firstNotice: " + firstNotice);
        logDebug("excludeRecordType: " + excludeRecordsArray);
        logDebug("excludeRecordStatus: " + excludeRecordStatusArray);
        logDebug("adminEmail: " + adminEmail);
        logDebug("batchResultEmailTemplate: " + batchResultEmailTemplate);

        // get max seconds
        var maxSeconds = aa.env.getValue("Time Out");
        if (!maxSeconds || typeof(maxSeconds, 'undefined')) {
            maxSeconds = 5 * 60; //default 5 minutes
        }

        // loop through array and process notification rules
        for (rec in recordIdObjectArray) {
            if (elapsed() > maxSeconds) // only continue if time hasn't expired
            {
                logDebug("A script timeout has caused partial completion of this process.  Please re-run.  " + elapsed() + " seconds elapsed, " + maxSeconds + " allowed.");
                timeExpired = true;
                break;
            }

            thisCap = recordIdObjectArray[rec];
			// logDebug(thisCap);   // added mz
			// logDebugObject(thisCap);  // added mz
            logDebug("thisCap: " + thisCap);
            recordIdObject = aa.cap.getCapID(thisCap.getCapID().getID1(), thisCap.getCapID().getID2(), thisCap.getCapID().getID3()).getOutput();
            if (!recordIdObject) {
                logDebug("Could not get a capIdObject for " + thisCap.getCapID().getID1() + "-" + thisCap.getCapID().getID2() + "-" + thisCap.getCapID().getID3());
                continue;
            }
            var recordId = recordIdObject.getCustomID();
            var thisRecord = new Record(recordId);
            var thisRecordType = thisRecord.getCapType();
            var thisRecordTypeString = thisRecordType.toString();
            var thisRecordStatus = thisRecord.getCapStatus();
            var recordName = thisRecord.getApplicationName();

            //get expiration info for license
            var b1ExpDate = thisRecord.getExpirationDate();
            logDebug("Expiration date: " + b1ExpDate)

            //use values configured in JSON (search JSON) or use Default
            var nextNotifDateGrp=null,nextNotifDateFld=null;
            if(searchRules.hasOwnProperty("nextDateField") && searchRules.nextDateField!=null && searchRules.nextDateField!=""){
            	var tmpJsonVal = searchRules.nextDateField.split(".");
            	nextNotifDateGrp = tmpJsonVal[0];
            	nextNotifDateFld = tmpJsonVal[1];
            }else{
            	nextNotifDateGrp = null;
            	nextNotifDateFld = "Next Notification Date";
            }
            var nextNotifGrp=null,nextNotifFld=null;
            if(searchRules.hasOwnProperty("nextNotificationField") && searchRules.nextNotificationField!=null && searchRules.nextNotificationField!=""){
            	var tmpJsonVal = searchRules.nextNotificationField.split(".");
            	nextNotifGrp = tmpJsonVal[0];
            	nextNotifFld = tmpJsonVal[1];
            }else{
            	nextNotifGrp = null;
            	nextNotifFld = "Next Notification";
            }
            
            //check record for next notification
            var thisNextNotificationDate = thisRecord.getASI(nextNotifDateGrp, nextNotifDateFld);
            var thisNextNotification = thisRecord.getASI(nextNotifGrp, nextNotifFld);
            logDebug("thisNextNotification: " + thisNextNotification);
            if (!thisNextNotification) {
                thisNextNotification = firstNotice;
            }
            if (!thisNextNotification) {
                logDebug("Next Notification custom field is blank and firstNotice is not configured, no notification will be sent.");
                continue;
            }

            logDebug("Processing record: " + recordId + " - " + recordName + ": Record Status : " + thisRecordStatus + ", Expires on " + b1ExpDate);
            statProcessedCount++;
            // check if record type is in excludeRecordsArray
            var skipRecord = isRecordTypeExcluded(thisRecordTypeString, excludeRecordsArray);
            if (skipRecord) {
                statFilterType++;
                logDebug("This records type is in the list of records to exclude: " + recordId + " - " + thisRecordTypeString);
                continue;
            }
            // check if record status is in excludeRecordStatusArray
            var skipRecord = isRecordStatusExcluded(thisRecordStatus, excludeRecordStatusArray);
            if (skipRecord) {
                statFilterStatus++;
                logDebug("This records status is in the list of statuses to exclude: " + recordId + " - " + thisRecordStatus)
                continue;
            }

            // get JSON rules for record type
			appTypeArray = thisRecordTypeString.split("/")
            var myRules = getJSONRulesForNotification(noticeRules, thisRecordTypeString, thisNextNotification);
			logDebug("myRules: " + myRules);
			logDebugObject(myRules);
			logDebug("thisRecordTypeString: " + thisRecordTypeString);
			logDebug("thisNextNotification: " + thisNextNotification);
            if (!myRules || typeof myRules === 'undefined') {
                logDebug("No Rules defined for the configured search criteria. Record Type: " + thisRecordTypeString + ". Notice: " + thisNextNotification);
                logDebug("Please check the batch job configuration script.");
                logException("EXCEPTION: Record ID: " + recordId + ", Type: " + thisRecordTypeString + ", Status: " + thisRecordStatus);
                statExceptions++;
                continue;
            }

            // create variables for notification rules
            var notificationTemplate = myRules.notificationTemplate;
            var notificationReport = myRules.notificationReport;
            var mailerSetType = myRules.mailerSetType;
            var mailerSetStatus = myRules.mailerSetStatus;
            var mailerSetPrefix = myRules.mailerSetPrefix;
            var notifyContactTypes = myRules.notifyContactTypes;
            var updateExpirationStatus = myRules.updateExpirationStatus;
            var updateRecordStatus = myRules.updateRecordStatus;
            var updateWorkflowTask = myRules.updateWorkflowTask;
            var updateWorkflowStatus = myRules.updateWorkflowStatus;
            var nextNotificationDays = myRules.nextNotificationDays;
            var nextNotification = myRules.nextNotification;
            var inspectionType = myRules.inspectionType;
            var scheduleOutDays = myRules.scheduleOutDays;
            var cancelAllInspections = myRules.cancelAllInspections ;
            var invoiceOnNotification = myRules.invoiceOnNotification ;
			var penalizeOnNotification = myRules.penalizeOnNotification;
			var assessFeesArray = myRules.assessFees ;

            // validate configuration
            if (!mailerSetPrefix || !notificationTemplate || !notifyContactTypes) {
                logDebug("WARNING: Cannot process this renewal. Check the JSON configuration. The following parameters are required in order to process a renewal: ");
                logDebug("notificationTemplate, mailerSetPrefix, notifyContactTypes");
                logException("EXCEPTION: Record ID: " + recordId + ", Type: " + thisRecordTypeString + ", Status: " + thisRecordStatus);
                statExceptions++;
                continue;
            }
            if (!notificationReport) logDebug("notificationReport is not configured for this record type, no notification report will be printed or sent.");
            if (typeof updateExpirationStatus === 'undefined') logDebug("updateExpirationStatus is not configured, expiration status will not be updated.");
            if (typeof updateRecordStatus === 'undefined') logDebug("updateRecordStatus is not configured, record status will not be updated.");
            if (typeof updateWorkflowTask === 'undefined' || typeof updateWorkflowStatus === 'undefined') logDebug("updateWorkflowTask and/or updateWorkflowStatus is not configured, workflow will not be updated.");

            logDebug("notificationTemplate: " + notificationTemplate);
            logDebug("notificationReport: " + notificationReport);
            logDebug("mailerSetType: " + mailerSetType);
            logDebug("mailerSetStatus: " + mailerSetStatus);
            logDebug("mailerSetPrefix: " + mailerSetPrefix);
            logDebug("notifyContactTypes: " + notifyContactTypes);
            logDebug("updateExpirationStatus: " + updateExpirationStatus);
            logDebug("updateRecordStatus: " + updateRecordStatus);
            logDebug("updateWorkflowTask: " + updateWorkflowTask);
            logDebug("updateWorkflowStatus: " + updateWorkflowStatus);
            logDebug("nextNotificationDays: " + nextNotificationDays);
            logDebug("nextNotification: " + nextNotification);
            logDebug("cancelAllInspections: " + cancelAllInspections ) ; 
			if(typeof(invoiceOnNotification) != 'undefined') logDebug("invoiceOnNotification: " + invoiceOnNotification  ) ;
			logDebug("penalizeOnNotification" + penalizeOnNotification);
			if(typeof(assessFeesArray) != 'undefined') logDebug("assessFeesArray length:" + assessFeesArray.length  ) ;
         
            // TO DO: add validation of rule params

            // update expiration status
            if (updateExpirationStatus) {
                thisExpDate = new Date(b1ExpDate);
                thisRecord.setExpiration(thisExpDate, updateExpirationStatus);
            }
            // update record status
            if (updateRecordStatus) {
                thisRecord.updateStatus(updateRecordStatus, "Updated by renewal batch process.")
            }
            // update workflow task and status
            if (updateWorkflowTask && updateWorkflowStatus) {
                updateTask(updateWorkflowTask, updateWorkflowStatus, "", "Updated by renewal batch process.", false, recordIdObject);
            }
            // send email notifications
            if (notifyContactTypes) {
                var contactTypeString = new String(notifyContactTypes);
                var contactTypeArr = contactTypeString.split(",");
//  mz - this is causing error capDetailObjResult not defined 
prepAndSendNotification(agencyReplyEmail, contactTypeArr, acaURL, notificationTemplate, notificationReport, recordIdObject);
            }

            // TO DO: add to mailer set if preferred channel is not email

            var addResult = addRecordToMailerSet(recordIdObject, mailerSetPrefix, mailerSetType, mailerSetStatus);
            if (addRecordToMailerSet) statMailerSetCount++;

            // update next notification and next notification date custom fields
            thisRecord.editASI(nextNotifGrp, nextNotifFld, nextNotification);
            var nextNotificationDate = "";
            if (nextNotificationDays != "") {
                nextNotificationDate = dateAdd(b1ExpDate, parseInt(-nextNotificationDays));
            }
            thisRecord.editASI(nextNotifDateGrp, nextNotifDateFld, nextNotificationDate);
            //logDebug("nextNotification: " + nextNotification);
            //logDebug("nextNotificationDate: " + nextNotificationDate);

            //schedule inspection 
            if (inspectionType != null && inspectionType != "" && scheduleOutDays != null && scheduleOutDays != "") {
                scheduleInspection(inspectionType, scheduleOutDays);
            }
		    //cancel All Inspections 
            if(cancelAllInspections)
        	{
        	 thisRecord.cancelAllInspection() ;
        	}
		 //Adding auto assess invoice 	 
		 //to force program element automation to assess and invoice fees when notifications are sent using STDBASE_PROGRAM_ELEMENT_AUTOMATION
		  if (typeof(invoiceOnNotification) != 'undefined' && invoiceOnNotification) {
			  var capId = recordIdObject; // added by mz to force the capId from the batch job
			  var controlString = 'AnnualRenewal' 
			  appTypeArray = thisRecordTypeString.split("/")
			  logDebug('Attempt to log fees');
			  eval(getScriptText('STDBASE_PROGRAM_ELEMENT_AUTOMATION')); 
		  }
		  if (typeof(penalizeOnNotification) != 'undefined' && penalizeOnNotification) {
			  var capId = recordIdObject; // added by mz to force the capId from the batch job
			  var controlString = 'Penalization' 
			  appTypeArray = thisRecordTypeString.split("/")
			  logDebug('Attempt to log fees');
			  eval(getScriptText('STDBASE_PROGRAM_ELEMENT_AUTOMATION')); 
		  }
		  if (!isEmptyOrNull(assessFeesArray) ) {
			for ( var i in assessFeesArray) {
				var feeCode = assessFeesArray[i]["feeCode"];
				var feeSchedule = assessFeesArray[i]["feeSchedule"];
				var feeQuantity = parseInt(assessFeesArray[i]["feeQuantity"]);
				var feeInvoice = assessFeesArray[i]["feeInvoice"];
				var feePeriod = assessFeesArray[i]["feePeriod"];
				var feeSchduleList = aa.finance.getFeeScheduleList("").getOutput();
				logDebug("feeCode:" + feeCode);
						logDebug("feeSchedule:" + feeSchedule );
						logDebug("feePeriod:" +  feePeriod);
						logDebug("feeQuantity:" +  feeQuantity);
						logDebug("feeInvoice:" +  feeInvoice);
						logDebug("capId:" + recordIdObject );
				for ( var i in feeSchduleList) {
					if (feeSchduleList[i].getFeeSchedule() == feeSchedule) 
					{
						addFee(feeCode, feeSchedule, feePeriod, feeQuantity, feeInvoice, recordIdObject);
					}
					}
				} 

			}		 
        }

        var resultParams = aa.util.newHashtable();
        addParameter(resultParams, "$$batchProcess$$", batchProcess.toString());
        addParameter(resultParams, "$$statTotalCount$$", statTotalCount.toString());
        addParameter(resultParams, "$$statProcessedCount$$", statProcessedCount.toString());
        addParameter(resultParams, "$$statFilterType$$", statFilterType.toString());
        addParameter(resultParams, "$$statFilterStatus$$", statFilterStatus.toString());
        addParameter(resultParams, "$$statMailerSetCount$$", statMailerSetCount.toString());

        // send batch result email
        sendBatchResultEmail(agencyReplyEmail, adminEmail, batchResultEmailTemplate, resultParams, null, null);

        logMessage("Total records found: " + statTotalCount);
        logMessage("Total records processed: " + statProcessedCount);
        logMessage("Ignored due to record type: " + statFilterType);
        logMessage("Ignored due to record status: " + statFilterStatus);
        logMessage("Total exceptions: " + statExceptions);
        logMessage("Total records added to mailer sets: " + statMailerSetCount);

        logMessage(exceptions);


    } catch (e) {
        logMessage("ERROR:" + e + "");
        logMessage("Total records found: " + statTotalCount);
        logMessage("Total records processed: " + statProcessedCount);
        logMessage("Ignored due to record type: " + statFilterType);
        logMessage("Ignored due to record status: " + statFilterStatus);
        logMessage("Total exceptions: " + statExceptions);
        logMessage("Total records added to mailer sets: " + statMailerSetCount);

        logMessage(exceptions);


        var resultParams = aa.util.newHashtable();
        addParameter(resultParams, "$$batchProcess$$", batchProcess);
        addParameter(resultParams, "$$statTotalCount$$", statTotalCount);
        addParameter(resultParams, "$$statProcessedCount$$", statProcessedCount);
        addParameter(resultParams, "$$statFilterType$$", statFilterType);
        addParameter(resultParams, "$$statFilterStatus$$", statFilterStatus);
        addParameter(resultParams, "$$statExceptions$$", statExceptions);
        addParameter(resultParams, "$$statMailerSetCount$$", statMailerSetCount);

        // send batch result email
        // potentially add result report to the batch result email, data/queries to validate the renewal process
        sendBatchResultEmail(agencyReplyEmail, adminEmail, batchResultEmailTemplate, resultParams, null, null);
    }

}

/** 
 * addRecordToMailerSet(recordIdObject,setPrefix,setType,setStatus);
 */
function addRecordToMailerSet(recordIdObject, setPrefix, setType, setStatus) {
    // search for an open mailer set, if it doesn't exist, create a new one
    var setId;
    var setType = "Renewal";
    var setStatus = "Open";
    var setHeaderSearch = aa.set.getSetHeaderScriptModel().getOutput();
    setHeaderSearch.setSetID(setPrefix);
    setHeaderSearch.setRecordSetType(setType);
    setHeaderSearch.setSetStatus(setStatus);
    var setSearchResult = aa.set.getSetHeaderListByModel(setHeaderSearch);
    if (setSearchResult.getSuccess) {
        var setArray = setSearchResult.getOutput();
        if (setArray) {
            setArray = setArray.toArray();
            logDebug("Sets found: " + setArray.length);
            for (s in setArray) {
                logDebug("setArray: " + setArray[s]);
                var thisSetHeader = setArray[s];
                setId = thisSetHeader.getSetID();
                logDebug("setId: " + setId);
                logDebug("setType: " + thisSetHeader.getSetType());
                logDebug("setRecordSetType: " + thisSetHeader.getRecordSetType());
                logDebug("setStatus: " + thisSetHeader.getSetStatus());
                continue;
            }
        } else {
            logDebug("No existing mailer sets found. Creating a new one. Set ID: " + setId);
        }
    }

    //if setId is null at this point then create a new set, else get the set that was found
    if (!setId) {
        var yy = startDate.getFullYear().toString();
        var mm = (startDate.getMonth() + 1).toString();
        if (mm.length < 2)
            mm = "0" + mm;
        var dd = startDate.getDate().toString();
        if (dd.length < 2)
            dd = "0" + dd;

        setId = setPrefix + "_" + mm + "/" + dd + "/" + yy;
    }

    // get or create the set and add the record to the set
    var mailerSet = new capSet(setId);
    if (mailerSet.empty) {
        // This is a new set that needs to be updated with informaiton
        mailerSet.type = setType;
        mailerSet.status = setStatus;
        mailerSet.comment = "Renewal mailer set created by renewal batch script process.";
        mailerSet.update();
        mailerSet.add(recordIdObject);
    } else {
        // This is an existing set so we will add the new record to it
        mailerSet.add(recordIdObject);
    }
    return true;
}


/**
 * Sends the renewal notification via email
 * @param {*} agencyReplyEmail 
 * @param {*} contactTypesArray 
 * @param {*} acaURL 
 * @param {*} notificationTemplate 
 * @param {*} reportName 
 */
function prepAndSendNotification(agencyReplyEmail, contactTypesArray, acaURL, notificationTemplate, reportName) {

    var itemCapId = capId;
    if (arguments.length == 6) itemCapId = arguments[5]; // use cap ID specified in args

    // work around until enhanced
    capId = itemCapId;

    capIDString = itemCapId.getCustomID();
    cap = aa.cap.getCap(itemCapId).getOutput();
    capName = cap.getSpecialText();
    capStatus = cap.getCapStatus();
    capTypeAlias = cap.getCapType().getAlias();
    partialCap = !cap.isCompleteCap();
    fileDateObj = cap.getFileDate();
    fileDate = "" + fileDateObj.getMonth() + "/" + fileDateObj.getDayOfMonth() + "/" + fileDateObj.getYear();
    fileDateYYYYMMDD = dateFormatted(fileDateObj.getMonth(), fileDateObj.getDayOfMonth(), fileDateObj.getYear(), "YYYY-MM-DD");
	logDebug("capId = " + capId); //mz
	logDebug("itemCapId = " + itemCapId); //mz
    var capDetailObjResult = aa.cap.getCapDetail(itemCapId);
	if (typeof(capDetailObjResult) != 'undefined') {
		if (capDetailObjResult.getSuccess()) {
			logDebug("Success capDetailObjResult = " + capDetailObjResult);
			capDetail = capDetailObjResult.getOutput();
			houseCount = capDetail.getHouseCount();
			feesInvoicedTotal = capDetail.getTotalFee();
			balanceDue = capDetail.getBalance();
		}

    // Get an array of Contact Objects using Master Scripts 3.0
    logDebug("contactTypesArray: " + contactTypesArray);
    var contactObjArray = getContactObjs(itemCapId, contactTypesArray);

    for (iCon in contactObjArray) {

        var tContactObj = contactObjArray[iCon];
        logDebug("ContactName: " + tContactObj.people.getFirstName() + " " + tContactObj.people.getLastName());
        if (!matches(tContactObj.people.getEmail(), null, undefined, "")) {
            logDebug("Contact Email: " + tContactObj.people.getEmail());
            var eParams = aa.util.newHashtable();
            addParameter(eParams, "$$recordTypeAlias$$", capTypeAlias);  
			getRecordParams4Notification(eParams);
			addParameter(eParams, "$$recordAlias$$", capTypeAlias);
			addParameter(eParams, "$$recordStatus$$", capStatus);
			addParameter(eParams, "$$balance$$", balanceDue);
			addParameter(eParams, "$$recordName$$",capName );			
			var capAddresses = aa.address.getAddressByCapId(capId);
				if (capAddresses.getSuccess()) {
					capAddresses = capAddresses.getOutput();
					if (capAddresses != null && capAddresses.length > 0) {
						capAddresses = capAddresses[0];
						var addressVar = "";
						addressVar = capAddresses.getHouseNumberStart() + " ";
						addressVar = addressVar + capAddresses.getStreetName() + " ";
						addressVar = addressVar + capAddresses.getCity() + " ";
						addressVar = addressVar + capAddresses.getState() + " ";
						addressVar = addressVar + capAddresses.getZip();
						addParameter(eParams, "$$FullAddress$$", addressVar);
					}
				}
				
				var b1ExpResult = aa.expiration.getLicensesByCapID(capId );
				if(b1ExpResult.getSuccess())
					{
					var b1Exp = b1ExpResult.getOutput();
					var tmpDate = b1Exp.getExpDate(); 
					if(tmpDate)
						{
						var expirationDate =  tmpDate.getMonth() + "/" + tmpDate.getDayOfMonth() + "/" + tmpDate.getYear(); 
						addParameter(eParams, "$$ExpirationDate$$", expirationDate);
						}
					}
            getACARecordParam4Notification(eParams, acaURL);
            tContactObj.getEmailTemplateParams(eParams, "Contact");
            //getInspectionResultParams4Notification(eParams);
            //getPrimaryAddressLineParam4Notification(eParams);

            if (!matches(reportName, null, undefined, false, "")) {
                // Call runReport4Email to generate the report and send the email
                // Set the report parameters. For Ad Hoc use p1Value, p2Value etc.
                var rptParams = aa.util.newHashMap();
                rptParams.put("p1Value", capIDString);
                runReport4Email(itemCapId, reportName, tContactObj, rptParams, eParams, notificationTemplate, cap.getCapModel().getModuleName(), agencyReplyEmail);
            } else {
                // Call sendNotification if you are not using a report
                sendNotification(agencyReplyEmail, tContactObj.people.getEmail(), "", notificationTemplate, eParams, null, itemCapId);
            }
        }
    }
	}else{
		logDebug("ERROR: capDetailObjResult is undefined");
	}
}


/**
 * Gets the notification rules from JSON config by searching for record type.
 * This function uses wild card searches in config. It will return the most exact match first.
 * @example The JSON is configured in CONF_LIC_RENEWAL
 * Example JSON Configuration (Use stars instead of ~ in example) :
 * var noticeRules = {
  "Licenses/~/~/~": {
	"60 Day Notice": {
	  "notificationTemplate": "LIC_ABOUT_TO_EXPIRE",
	  "notificationReport": "Licenses About to Expire",
	  "mailerSet": "LIC_ABOUT_TO_EXPIRE_MAILER",
	  "updateStatus": "About to Expire",
	  "nextNotificationDays": 45,
	  "nextNotification": "45 Day Notice"
	},
	"45 Day Notice": {
	  "notificationTemplate": "LIC_EXPIRE_45_DAY_NOTICE",
	  "notificationReport": "License Expiration 45 Day Notice",
	  "mailerSet": "LIC_EXPIRATION_45_DAY_NOTICE",
	  "updateStatus": false,
	  "nextNotificationDays": 30,
	  "nextNotification": "30 Day Notice"
	},
	"30 Day Notice": {
	  "notificationTemplate": "LIC_EXPIRE_30_DAY_NOTICE",
	  "notificationReport": "License Expiration 30 Day Notice",
	  "mailerSet": "LIC_EXPIRATION_30_DAY_NOTICE",
	  "updateStatus": false,
	  "nextNotificationDays": 0,
	  "nextNotification": "Expiration Notice"
	},
	"Expiration Notice": {
	  "notificationTemplate": "LIC_EXPIRE_NOTICE",
	  "notificationReport": "License Expiration Notice",
	  "mailerSet": "LIC_EXPIRATION_NOTICE",
	  "updateStatus": false,
	  "nextNotificationDays": false,
	  "nextNotification": false
	}
  }
}
 * 
 * @param {JSONConfig} rules The noticeRules in the CONF_LIC_RENEWAL JSON Config object
 * @param {String} recordType The record type to search for (Example: Licenses/Business/General/License)
 * @param {String} notification The notification to search for (Example: 30 Day Notice)
 */
function getJSONRulesForNotification(rules, recordType, notification) {
    if (typeof rules != 'undefined' && typeof notification != 'undefined') {
        if (typeof(recordType) == "object") {
            var appTypeArray = recordType.split("/");
            var thisRule;

            logDebug("Searching for JSON Rules for " + appTypeArray[0] + "/" + appTypeArray[1] + "/" + appTypeArray[2] + "/" + appTypeArray[3]);
            var thisRule = rules[appTypeArray[0] + "/" + appTypeArray[1] + "/" + appTypeArray[2] + "/" + appTypeArray[3]];
            if (typeof thisRule != 'undefined' && typeof thisRule[notification] != 'undefined') return thisRule[notification];

            logDebug("Searching for JSON Rules for " + appTypeArray[0] + "/" + appTypeArray[1] + "/*/" + appTypeArray[3]);
            var thisRule = rules[appTypeArray[0] + "/" + appTypeArray[1] + "/*/" + appTypeArray[3]];
			logDebug("typeof thisRull : "+ typeof thisRule);
			logDebug("typeof thisRule[notification] : "+ typeof thisRule[notification]);
            if (typeof thisRule != 'undefined' && typeof thisRule[notification] == 'undefined') return thisRule[notification];

            logDebug("Searching for JSON Rules for " + appTypeArray[0] + "/*/*/" + appTypeArray[3]);
            var thisRule = rules[appTypeArray[0] + "/*/*/" + appTypeArray[3]];
            if (typeof thisRule != 'undefined' && typeof thisRule[notification] != 'undefined') return thisRule[notification];

            logDebug("Searching for JSON Rules for " + appTypeArray[0] + "/*/" + appTypeArray[2] + "/" + appTypeArray[3]);
            var thisRule = rules[appTypeArray[0] + "/*/" + appTypeArray[2] + "/" + appTypeArray[3]];
            if (typeof thisRule != 'undefined' && typeof thisRule[notification] != 'undefined') return thisRule[notification];

            logDebug("Searching for JSON Rules for " + appTypeArray[0] + "/*/" + appTypeArray[2] + "/*");
            thisRule = rules[appTypeArray[0] + "/*/" + appTypeArray[2] + "/*"];
            if (typeof thisRule != 'undefined' && typeof thisRule[notification] != 'undefined') return thisRule[notification];

            logDebug("Searching for JSON Rules for " + appTypeArray[0] + "/" + appTypeArray[1] + "/" + appTypeArray[2] + "/*");
            thisRule = rules[appTypeArray[0] + "/" + appTypeArray[1] + "/" + appTypeArray[2] + "/*"];
            if (typeof thisRule != 'undefined' && typeof thisRule[notification] != 'undefined') return thisRule[notification];

            logDebug("Searching for JSON Rules for " + appTypeArray[0] + "/" + appTypeArray[1] + "/*/*");
            thisRule = rules[appTypeArray[0] + "/" + appTypeArray[1] + "/*/*"];
            if (typeof thisRule != 'undefined' && typeof thisRule[notification] != 'undefined') return thisRule[notification];

            logDebug("Searching for JSON Rules for " + appTypeArray[0] + "/*/*/*");
            thisRule = rules[appTypeArray[0] + "/*/*/*"];
            if (typeof thisRule != 'undefined' && typeof thisRule[notification] != 'undefined') return thisRule[notification];

            return false;

        }
    }
}

function isEmptyOrNull(value) {
	return value == null || value === undefined || String(value) == "";
}

function logDebugObject(myObject) {
/*
usage - logDebugObject(object)

author - Michael Zachry
created - 10/10/2018

updates
10/11/2018 - initial version

*/
  //list the methods
  try {
    logDebug("object is is a " + myObject.getClass());
    logDebug("object has the following methods:");
    for (x in myObject) {
      if (typeof(myObject[x]) == "function" ) {
        logDebug("  " + x);
      }
    }
  } catch (err) {
    logDebug("A JavaScript Error occured: " + err.message);
  }
  try {
    //list the properties and values    
    logDebug("object has the following properties and values:");
    for (x in myObject) {
      if (typeof(myObject[x]) != "function" ) {
        logDebug("  " + x + " = " + myObject[x]);
      }
    }
  } catch (err) {
    logDebug("A JavaScript Error occured: " + err.message);
  }
}

