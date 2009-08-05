if (typeof(Cc) == 'undefined')
	var Cc = Components.classes;
if (typeof(Ci) == 'undefined')
	var Ci = Components.interfaces;
if (typeof(Cu) == 'undefined')
	var Cu = Components.utils;
if (typeof(Cr) == 'undefined')
	var Cr = Components.results; 
	  
// Make a namespace.
if (typeof VandelayIndustries == 'undefined') {
  var VandelayIndustries = {};
}

/**
 * UI controller that is loaded into the main player window
 */
VandelayIndustries.Controller = 
{
  onLoad: function() 
  {
    // initialization code
    this._initialized = true;
    
    // Perform extra actions the first time the extension is run
    if (Application.prefs.get("extensions.vandelay-industries.firstrun").value) 
    {
      Application.prefs.setValue("extensions.vandelay-industries.firstrun", false);
      this._firstRunSetup();
    }

    var controller = this;

    this._importPlayCountCmd = document.getElementById("vandelay-industries-importplaycount-cmd");
    this._importPlayCountCmd.addEventListener("command", 
         function() { controller.doImportPlayCount(); }, false);
         
    this._importLovedTracksCmd = document.getElementById("vandelay-industries-importlovedtracks-cmd");
    this._importLovedTracksCmd.addEventListener("command", 
         function() { controller.doImportLovedTracks(); }, false);

  },

  onUnLoad: function() 
  {
    this._initialized = false;
  },
  
  doImportPlayCount : function() 
  {
    window.open
    (
      "chrome://vandelay-industries/content/import-playcount-window.xul", 
      "import-playcount-window", 
      "chrome,centerscreen,width=620,height=580,resizable=yes"
    );
  },
  
  doImportLovedTracks : function() 
  {
    window.open
    (
      "chrome://vandelay-industries/content/import-lovedtracks-window.xul", 
      "import-lovedtracks-window", 
      "chrome,centerscreen,width=450,height=500,resizable=yes"
    );
  },

  _firstRunSetup : function() 
  {  
  },
  
};

window.addEventListener("load", function(e) { VandelayIndustries.Controller.onLoad(e); }, false);
window.addEventListener("unload", function(e) { VandelayIndustries.Controller.onUnLoad(e); }, false);
