// SPDX-FileCopyrightText: 2023 XWiki CryptPad Team <contact@cryptpad.org> and contributors
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * You can override the translation text using this file.
 * The recommended method is to make a copy of this file (/customize.dist/translations/messages.{LANG}.js)
   in a 'customize' directory (/customize/translations/messages.{LANG}.js).
 * If you want to check all the existing translation keys, you can open the internal language file
   but you should not change it directly (/common/translations/messages.{LANG}.js)
*/
define(['/common/translations/messages.js'], function (Messages) {
    // Replace the existing keys in your copied file here:
    Messages.main_title = "CryptPaws: Collaboration suite, encrypted and open-source";

    // Rename the drive app type label
    Messages.type.drive = "CryptPaws Drive";

    // Guest storage disabled
    Messages.anonymousStoreDisabled = "The administrator of this CryptPaws instance has disabled storage for guests. Log in to access your own CryptPaws Drive.";

    // Redirect to home on error
    Messages.errorRedirectToHome = "Press Esc to be redirected to your CryptPaws Drive.";

    // New version notification
    Messages.newVersionError = "A new version of CryptPaws is available.<br><a href='#'>Reload</a> to use the new version, or press escape to access your content in <b>offline mode</b>.";

    // Disabled app message
    Messages.disabledApp = "This application has been disabled. Contact the administrator of this CryptPaws for more information.";

    // Storage limit alerts
    Messages.pinLimitReachedAlert = "You've reached your storage limit. New documents won't be stored in your CryptPaws Drive.<br>You can either remove documents from your CryptPaws Drive or <a>subscribe to a premium offer</a> to increase your limit.";
    Messages.pinLimitNotPinned = "You've reached your storage limit.<br>This document is not stored in your CryptPaws Drive.";

    // Upload/file picker
    Messages.uploadButtonTitle = "Upload a new file to your CryptPaws Drive";
    Messages.filePickerButton = "Embed a file stored in CryptPaws Drive";
    Messages.filePicker_description = "Choose a file from your CryptPaws Drive to embed it or upload a new one";

    // Media/canvas
    Messages.pad_mediatagImport = "Save in your CryptPaws Drive";
    Messages.canvas_saveToDrive = "Save this image as a file in your CryptPaws Drive";

    // File manager
    Messages.fm_info_trash = "Empty your trash to free space in your CryptPaws Drive.";
    Messages.fm_info_sharedFolder = "This is a shared folder. You're not logged in so you can only access it in read-only mode.<br><a href=\"/register/\">Sign up</a> or <a href=\"/login/\">Log in</a> to be able to import it to your CryptPaws Drive and to modify it.";
    Messages.fm_burnThisDriveButton = "Erase all information stored by CryptPaws in your browser";
    Messages.fm_burnThisDrive = "Are you sure you want to remove everything stored by CryptPaws in your browser?<br>This will remove your CryptPaws Drive and its history from your browser, but your documents will still exist (encrypted) on our server.";
    Messages.fm_deletedPads = "These documents no longer exist on the server, they've been removed from your CryptPaws Drive: {0}";
    Messages.fm_info_sharedFolderHistory = "This is only the history of your shared folder: <b>{0}</b><br>Your CryptPaws Drive will stay in read-only mode while you navigate.";

    // Settings — drive category
    Messages.settings_cat_drive = "CryptPaws Drive";
    Messages.settings_backupHint = "Backup or restore all your CryptPaws Drive's content. It won't contain the content of your documents, just the keys to access them.";
    Messages.settings_backupHint2 = "Download all the documents in your drive. Documents will be downloaded in formats readable by other applications when such a format is available. When such a format is not available, documents will be downloaded in a format readable by CryptPaws.";
    Messages.settings_backup2 = "Download my CryptPaws Drive";
    Messages.settings_backup2Confirm = "This will download all the documents and files from your CryptPaws Drive. If you want to continue, pick a name and press OK";
    Messages.settings_exportTitle = "Export your CryptPaws Drive";
    Messages.settings_export_reading = "Reading your CryptPaws Drive...";
    Messages.settings_resetNewTitle = "Clean CryptPaws Drive";
    Messages.settings_reset = "Remove all the files and folders from your CryptPaws Drive";
    Messages.settings_resetPrompt = "This action will remove all documents from your drive.<br>Are you sure you want to continue?<br>Type \"\u200b<em>I love CryptPaws</em>\" to confirm.";
    Messages.settings_resetError = "Incorrect verification text. Your CryptPaws Drive has not been changed.";
    Messages.settings_resetTipsButton = "Reset the available tips in CryptPaws Drive";
    Messages.settings_disableThumbnailsAction = "Disable thumbnails creation in your CryptPaws Drive";
    Messages.settings_importTitle = "Import this browser's recent documents to your CryptPaws Drive";
    Messages.settings_importConfirm = "Are you sure you want to import recent documents from this browser to your user account's CryptPaws Drive?";
    Messages.settings_autostoreTitle = "Document storage in CryptPaws Drive";
    Messages.settings_autostoreHint = "<b>Automatic</b> All the documents you visit are stored in your CryptPaws Drive.<br><b>Manual (always ask)</b> If you have not stored a document yet, you will be asked if you want to store them in your CryptPaws Drive.<br><b>Manual (never ask)</b> Documents are not stored automatically in your CryptPaws Drive. The option to store them will be hidden.";
    Messages.settings_userFeedbackHint1 = "CryptPaws provides some very basic feedback to the server, to let us know how to improve your experience. ";
    Messages.settings_deleteHint = "Account deletion is permanent. Your CryptPaws Drive and your list of documents will be deleted from the server. The rest of your documents will be deleted in 90 days if nobody else has stored them in their CryptPaws Drive.";
    Messages.settings_deleteModal = "Share the following information with your CryptPaws administrator in order to have your data removed from their server.";
    Messages.settings_driveDuplicateHint = "When you move your owned documents to a shared folder, a copy is kept in your CryptPaws Drive to ensure that you retain your control over it. You can hide duplicated files. Only the shared version will be visible, unless deleted, in which case the original will be displayed in its previous location.";
    Messages.settings_ownDriveHint = "Older accounts do not have access to the latest features, due to technical reasons. A free update will enable current features, and prepare your CryptPaws Drive for future updates.";
    Messages.settings_changePasswordError = "An unexpected error occurred. If you are unable to login or change your password, contact your CryptPaws administrators.";
    Messages.settings_safeLinksHint = "CryptPaws includes the keys to decrypt your documents in their links. Anyone with access to your browsing history can potentially read your data. This includes intrusive browser extensions and browsers that sync your history across devices. Enabling \"safe links\" prevents the keys from entering your browsing history or being displayed in your address bar whenever possible. We strongly recommend that you enable this feature and use the {0} Share menu to generate shareable links.";
    Messages.settings_cacheHint = "CryptPaws stores parts of your documents in your browser's memory in order to save network usage and improve loading times. You can disable the cache if your device doesn't have a lot of free storage space. For security reasons, the cache is always cleared when you log out, but you can clear it manually if you want to reclaim storage space on your machine.";
    Messages.settings_colorthemeHint = "Change the overall colors of CryptPaws on this device.";

    // Upload
    Messages.uploadFolder_modal_forceSave = "Store files in your CryptPaws Drive";
    Messages.upload_notEnoughSpace = "There is not enough space for this file in your CryptPaws Drive.";

    // Document image migration
    Messages.pad_base64 = "This document contains images stored in an inefficient way. These images will significantly increase the size of the document in your CryptPaws Drive, and make it slower to load. You can migrate these files to a new format which will be stored separately in your CryptPaws Drive. Do you want to migrate these images now?";

    // Home page
    Messages.home_host = "This is an independent community instance of CryptPaws.";

    // Features/pricing
    Messages.features_f_cryptdrive0 = "Limited access to CryptPaws Drive";
    Messages.features_f_cryptdrive1 = "Complete CryptPaws Drive functionality";
    Messages.features_f_devices_note = "Access your CryptPaws Drive everywhere with your user account";
    Messages.features_f_file1_note = "Store files in your CryptPaws Drive: images, PDFs, videos, and more. Share them with your contacts or embed them in your documents. (up to {0}MB)";
    Messages.features_f_storage1_note = "Documents stored in your CryptPaws Drive are not deleted for inactivity";
    Messages.features_f_supporter_note = "Help CryptPaws to become financially sustainable and show that privacy-enhancing software willingly funded by users should be the norm";

    // Header
    Messages.header_logoTitle = "Go to your CryptPaws Drive";
    Messages.header_homeTitle = "Go to CryptPaws homepage";

    // Help
    Messages.help_genericMore = "Learn more about how CryptPaws can work for you by reading our <a>Documentation</a>";

    // Feedback
    Messages.feedback_about = "If you're reading this, you were probably curious why CryptPaws is requesting web pages when you perform certain actions.";
    Messages.feedback_privacy = "We care about your privacy, and at the same time we want CryptPaws to be very easy to use.  We use this file to figure out which UI features matter to our users, by requesting it along with a parameter specifying which action was taken.";

    // Creation / ownership
    Messages.creation_owned1 = "An <b>owned</b> item can be destroyed whenever the owner wants. Destroying an owned item makes it unavailable from other users' CryptPaws Drives.";

    // Password change warnings
    Messages.properties_passwordWarning = "The password was successfully changed but we were unable to update your CryptPaws Drive with the new data. You may have to remove the old version of the document manually.<br>Press OK to reload and update your access rights.";
    Messages.properties_passwordWarningFile = "The password was successfully changed but we were unable to update your CryptPaws Drive with the new data. You may have to remove the old version of the file manually.";

    // Shared folders
    Messages.sharedFolders_forget = "This document is only stored in a shared folder, you can't move it to the trash. You can use your CryptPaws Drive if you want to delete it.";
    Messages.sharedFolders_share = "Share this link with other registered users to give them access to the shared folder. Once they open this link, the shared folder will be added to their CryptPaws Drive.";

    // Auto-store
    Messages.autostore_notstored = "This {0} is not in your CryptPaws Drive. Do you want to store it now?";
    Messages.autostore_saved = "The document was successfully stored in your CryptPaws Drive!";
    Messages.autostore_forceSave = "Store the file in your CryptPaws Drive";
    Messages.autostore_notAvailable = "You must store this document in your CryptPaws Drive before being able to use this feature.";

    // Crowdfunding
    Messages.crowdfunding_button = "Support CryptPaws";
    Messages.crowdfunding_popup_text = "<h3>We need your help!</h3>To ensure that CryptPaws is actively developed, consider supporting the project via the OpenCollective page, where you can see our <b>Roadmap</b> and <b>Funding goals</b>.";
    Messages.survey = "CryptPaws survey";

    // Admin panel
    Messages.admin_diskUsageHint = "Amount of storage space consumed by various CryptPaws resources";
    Messages.admin_supportInitPrivate = "Your CryptPaws instance is configured to use a support mailbox but your account doesn't have the correct private key to access it. Please use the following form to add or update the private key to your account.";
    Messages.admin_supportInitHint = "You can configure a support mailbox in order to give users of your CryptPaws instance a way to contact you securely if they have an issue with their account.";
    Messages.admin_updateAvailableHint = "A new version of CryptPaws is available";
    Messages.admin_checkupHint = "CryptPaws includes a page which automatically diagnoses common configuration issues and suggests how to correct them if necessary.";
    Messages.admin_removeDonateButtonHint = "CryptPaws's development is partially funded by public grants and donations. Advertising our crowdfunding efforts on your instance helps the developers to continue improving the platform for everybody, but you may disable these notices if you find them inappropriate.";
    Messages.admin_blockDailyCheckHint = "CryptPaws instances send a message to the developers' server when launched and once per day thereafter. This lets them keep track of how many servers are running which versions of the software. You can opt-out of this measurement below. The contents of this message can be found in the application server's log for your review.";
    Messages.admin_defaultlimitHint = "Maximum storage limit for CryptPaws Drives (users and teams) when no custom rule is applied";
    Messages.admin_infoNotice1 = "Use the following fields to describe your instance. This information is used on the instance front page. It is also sent as part of the server telemetry if you opt in to be included in the list of public CryptPaws instances.";
    Messages.admin_blockMetadataHint = "The login block is what allows an account to log in to CryptPaws with the combination of username + password";
    Messages.admin_colorHint = "Change the accent color of your CryptPaws instance. Please ensure text and buttons are readable with sufficient contrast in both light and dark themes.";
    Messages.admin_invitationHint = "Invitation links create one account each, even if registration is closed. User name and email are for your identification purposes only. CryptPaws will not email the invitation link (or anything else), please copy the link and send it using the secure channel of your choice.";
    Messages.admin_onboardingNameTitle = "Welcome to your CryptPaws instance";

    // Support
    Messages.support_disabledHint = "This CryptPaws instance is not yet configured to use a support form.";
    Messages.support_formHint = "Use this form to securely contact the administrators about issues and questions.<br>Please note that some issues/questions may already be addressed in the <a>CryptPaws User Guide</a>. Please do not create a new ticket if you already have an open ticket about the same issue. Instead, reply to your original message with any additional information.";
    Messages.support_premiumPriority = "Premium users help support improvements to CryptPaws's usability and benefit from prioritized responses to their support tickets.";
    Messages.support_openTicketHint = "Copy the recipient user's data from their profile page or an existing support ticket. They will receive a CryptPaws notification about this message.";

    // Teams
    Messages.team_leaveConfirm = "If you leave this team you will lose access to its CryptPaws Drive, chat history, and other contents. Are you sure?";
    Messages.team_infoContent = "Each team has its own CryptPaws Drive, storage quota, chat, and members list. Team owners can delete the whole team, Admins can invite or kick members, members can leave the team.";
    Messages.team_exportHint = "Download all the documents in this team's drive. Documents will be downloaded in formats readable by other applications when such a format is available. When such a format is not available, documents will be downloaded in a format readable by CryptPaws.";

    // Drive shared folder
    Messages.drive_sfPassword = "Your shared folder {0} is no longer available. It has either been deleted by its owner or it is now protected with a new password. You can remove this folder from your CryptPaws Drive, or recover access using the new password.";

    // Offline error
    Messages.driveOfflineError = "Your connection to CryptPaws has been lost. Changes to this document will not be saved in your CryptPaws Drive. Please close all CryptPaws tabs and try again in a new window. ";

    // Sharing
    Messages.share_contactPasswordAlert = "This item is password protected. Because you are sharing it with a CryptPaws contact, the recipient will not have to enter the password.";
    Messages.share_noContactsLoggedIn = "You are not connected with anyone on CryptPaws yet. Share the link to your profile for people to send you contact requests.";

    // History migration
    Messages.trimHistory_needMigration = "Please <a>update your CryptPaws Drive</a> to enable this feature.";

    // User menu
    Messages.user_about = "About CryptPaws";

    // Drive history
    Messages.history_restoreDriveTitle = "Restore the selected version of the CryptPaws Drive";
    Messages.history_restoreDrivePrompt = "Are you sure you want to replace the current version of the CryptPaws Drive with the displayed version?";
    Messages.history_restoreDriveDone = "CryptPaws Drive restored";

    // Toolbar
    Messages.toolbar_storeInDrive = "Store in CryptPaws Drive";

    // OnlyOffice
    Messages.oo_importBin = "Click OK to import CryptPaws's internal .bin format.";
    Messages.oo_unstableMigrationWarning = "Import and Export of some OpenDocument formats (.odt, .odp) are currently unstable. We recommend using other formats where possible. CryptPaws will now attempt a best-effort conversion.";

    // Security
    Messages.resources_imageBlocked = "CryptPaws blocked a remote image";
    Messages.bounce_danger = "The link you clicked does not lead to a web-page but to some code or data that could be malicious.\n\n(\"{0}\")\n\nCryptPaws blocks these for security reasons. Clicking OK will close this tab.";

    // Source info
    Messages.info_sourceFlavour = "<a>Source code</a> for CryptPaws";

    // Embedding
    Messages.ui_openDirectly = "This functionality is not available when CryptPaws is embedded in another site. Open this document in a new tab?";
    Messages.error_embeddingDisabled = "Embedding is disabled for this CryptPaws instance";
    Messages.error_embeddingDisabledSpecific = "Embedding is disabled for this CryptPaws application.";
    Messages.error_evalPermitted = "Aborting because eval should not be permitted.\n\nThis error is linked to Content-Security-Policy headers, it could be due to: an outdated browser that does not support them, browser extensions that interfere with their correct behaviour, or an incorrect configuration of this CryptPaws instance.";

    // Open graph / metadata
    Messages.og_default = "CryptPaws: end-to-end encrypted collaboration suite";

    // MFA
    Messages.mfa_recovery_hint = "If you lose access to your authenticator app you may be locked out of your CryptPaws account. This recovery code can be used to disable 2FA and let you back in.";

    // Logo label
    Messages.label_logo = "CryptPaws logo";

    // SSO auth
    Messages.ssoauth_header = "CryptPaws Password";
    Messages.ssoauth_form_hint_register = "Add a CryptPaws password for extra security or leave empty and continue. If you do not add a password, the keys protecting your data will be available to the instance administrators.";
    Messages.ssoauth_form_hint_login = "Please enter your CryptPaws password";

    // Broadcast
    Messages.broadcast_maintenance = "Maintenance is scheduled between <b>{0}</b> and <b>{1}</b>. CryptPaws may be unavailable at that time.";

    // Popup blocked
    Messages.errorPopupBlocked = "CryptPaws needs to be able to open new tabs to operate. Please allow popup windows in your browser's address bar. These windows will never be used to show you advertising.";

    // Registration
    Messages.register_warning_note = "Due to the encrypted nature of CryptPaws, the service administrators will not be able to recover data in case you forget your username and/or password. Please save them in a safe place.";

    // Footer docs link — points to /features.html on this instance
    Messages.docs_link = "Features";

    // Homepage tagline
    Messages.main_catch_phrase = "End-to-end encrypted tools<br>for the animal liberation movement";

    // Rename Kanban to Projects
    Messages.type = Messages.type || {};
    Messages.type.kanban = "Projects";

    // Poll
    Messages.poll_descriptionHint = "Describe your poll, and use the \u2713 (publish) button when you're done.\nThe description can be written using markdown syntax and you can embed media elements from your CryptPaws Drive.\nAnyone with the link can change the description, but this is discouraged.";

    return Messages;
});

