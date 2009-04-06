if (typeof(Cc) == 'undefined')
	var Cc = Components.classes;
if (typeof(Ci) == 'undefined')
	var Ci = Components.interfaces;
if (typeof(Cu) == 'undefined')
	var Cu = Components.utils;
if (typeof(Cr) == 'undefined')
	var Cr = Components.results;

Cu.import("resource://app/jsmodules/sbProperties.jsm");
Cu.import("resource://app/jsmodules/sbLibraryUtils.jsm");
Cu.import("resource://app/jsmodules/kPlaylistCommands.jsm");

// Make a namespace.
if (typeof PlayCountImporterDialog == 'undefined') {
  var PlayCountImporterDialog = {};
}

const LAST_FM_ROOT_URL = "http://ws.audioscrobbler.com/2.0/";
const LAST_FM_API_KEY = "72b14fe3e1fd7f8ff8a993b1f1e78a50";

const LIBRARY_GETTRACKS_METHOD = "library.getTracks";

const REQUEST_SUCCESS_CODE = 200

const NUM_IMPORTS_PER_CALL = 50;
const NUM_CLEARS_PER_CALL = 200;

PlayCountImporterDialog.Controller = {
  onLoad: function() {
    var controller = this;
    this._strings = document.getElementById("vandelay-industries-strings");
    
    //todo make better strings
    
    this._defaultUsername = "";
    try {
      var lastFMService = Cc['@songbirdnest.com/lastfm;1']
                            .getService().wrappedJSObject;
      this._defaultUsername = lastFMService.username;
    }
    catch (e) {}
                            
    // Set up the tree views
    this._treeView = {  
        playCountArray: [],
        rowCount: 0,
        getCellText : function(row,column) {  
          if (column.id == "artist-column") return this.playCountArray[row].artistName;
          else if (column.id == "title-column") return this.playCountArray[row].trackName;
          else if (column.id == "play-count-column") return this.playCountArray[row].playCount;
          else if (column.id == "in-library-column") {
            var strings = document.getElementById("vandelay-industries-strings");
            var cellText = strings.getString("no"); // Should never be this
            if (this.playCountArray[row].songGuids.length > 0) {
              cellText = " x" + this.playCountArray[row].songGuids.length;
            }
            return (cellText); 
          }
          else return "";  
        },  
        setTree: function(treebox) { this.treebox = treebox; },  
        isContainer: function(row) { return false; },  
        isSeparator: function(row) { return false; },  
        isSorted: function() { return false; },  
        getLevel: function(row) { return 0; },  
        getImageSrc: function(row,col) { return null; },  
        getRowProperties: function(row,props) {},  
        getCellProperties: function(row,col,props) {},  
        getColumnProperties: function(colid,col,props) {}, 
        isEditable: function(row,col) { return this.playCountArray[row].songGuids.length > 0; },
        getCellValue: function(row,col) { return this.playCountArray[row].importIt ? "true" : "false"; },
        setCellValue: function(row,col,string) { this.playCountArray[row].importIt = (string == "true" ? true : false); this.treebox.invalidateRow(row); },
        update: function() { this.rowCount = this.playCountArray.length; } 
    };
    
    this._nilTreeView = {  
        nilPlayCountArray: [],
        rowCount: 0,
        getCellText : function(row,column) {  
          if (column.id == "nil-lfm-artist-column") return this.getLfmArtist(row);
          else if (column.id == "nil-lfm-title-column") return this.getLfmTrack(row);
          else if (column.id == "nil-lib-artist-column") return this.getLibArtist(row);
          else if (column.id == "nil-lib-title-column") return this.getLibTrack(row);
          else if (column.id == "play-count-column") return this.nilPlayCountArray[row].playCount;
          else return "";  
        },  
        setTree: function(treebox) { this.treebox = treebox; },  
        isContainer: function(row) { return false; },  
        isSeparator: function(row) { return false; },  
        isSorted: function() { return false; },  
        getLevel: function(row) { return 0; },  
        getImageSrc: function(row,col) { return null; },  
        getRowProperties: function(row,props) {},  
        getCellProperties: function(row,col,props) {},  
        getColumnProperties: function(colid,col,props) {}, 
        update: function() { this.rowCount = this.nilPlayCountArray.length; }, 
        getLfmArtist: function(row) { return this.nilPlayCountArray[row].lfmArtistName; },
        getLfmTrack: function(row) { return this.nilPlayCountArray[row].lfmTrackName; },
        getLibArtist: function(row) { return this.nilPlayCountArray[row].libArtistName; },
        getLibTrack: function(row) { return this.nilPlayCountArray[row].libTrackName; },
        setLibInfo: function(row, artist, track, guids) { 
          this.nilPlayCountArray[row].libArtistName = artist;
          this.nilPlayCountArray[row].libTrackName = track;
          this.nilPlayCountArray[row].songGuids = guids; 
        }
    };
    
    // Set the default username
    var usernameField = document.getElementById("last-fm-username-field");
    usernameField.value = this._defaultUsername;
    
    this._resumeCheckbox = document.getElementById("resume-search");
    
    this._findingPlayCounts = false;
    this._importingPlayCounts = false;
    this._processingFindButtonPress = false;
    this._clearingPlayCounts = false;

    this._findPlayCountsButton = document.getElementById("find-playcount-button");
    this._findPlayCountsButton.addEventListener("command", 
          function() { controller.findOrStopPlayCounts(); }, false);
          //function() { controller.fakePopulate(); }, false);
    usernameField.addEventListener("keypress", 
          function(event) { controller.onUsernameKeypress(event); }, false);
    usernameField.focus();
         
    this._importPlayCountsButton = document.getElementById("import-playcount-button");
    this._importPlayCountsButton.addEventListener("command", 
          function() { controller.importPlayCounts(); }, false);
         
    this._clearPlayCountsButton = document.getElementById("clear-playcounts-button");
    this._clearPlayCountsButton.addEventListener("command", 
          function() { controller.clearPlayCounts(); }, false);
          
    this._findPlayCountsButton.setAttribute("label", this._strings.getString("findButtonSearchLabel"));
    this._importPlayCountsButton.setAttribute("label", this._strings.getString("importButtonImportLabel"));
    this._clearPlayCountsButton.setAttribute("label", this._strings.getString("resetButtonResetLabel"));
    this._clearStatus();
    
    this._artistField = document.getElementById("edit-artist-textbox");
    this._artistCheck = document.getElementById("edit-artist-checkbox");
    this._trackField = document.getElementById("edit-track-textbox");
    this._trackCheck = document.getElementById("edit-track-checkbox");
    this._updateButton = document.getElementById("update-button");
    this._updateButton.addEventListener("command", 
          function() { controller.onUpdateNilSelection(); }, false);
          
    this._selectedRow = -1;
  },
  
  fakePopulate: function() {
    this._treeView.playCountArray.push({artistName: "artistName", trackName: "trackName", playCount: 1, songGuids: ["a", "b"], importIt: true});
    this._treeView.playCountArray.push({artistName: "artistName2", trackName: "trackName", playCount: 2, songGuids: ["a"], importIt: false});
    //this._treeView.playCountArray.push({artistName: "artistName3", trackName: "trackName", playCount: 3, songGuids: [], importIt: false});
    this._nilTreeView.nilPlayCountArray.push({lfmArtistName: "artistName3", lfmTrackName: "trackName", libArtistName: "", libTrackName: "", playCount: 3});
    this._updateTreeViews();
    
  },

  onUnLoad: function() {
  },
  
  onUsernameKeypress: function(event) {
    if (event.keyCode == 13) {
      PlayCountImporterDialog.Controller.findOrStopPlayCounts();
    }
    
    this._hideResumeCheckbox();
  },
  
  onNilTreeSelection: function(event) {
    this._selectedRow = event.target.currentIndex; 
    
    var libArtist = this._nilTreeView.getLibArtist(this._selectedRow);
    this._artistField.value = libArtist != null && libArtist.length > 0 ? libArtist : this._nilTreeView.getLfmArtist(this._selectedRow);
    
    var libTrack = this._nilTreeView.getLibTrack(this._selectedRow);
    this._trackField.value = libTrack != null && libTrack.length > 0 ? libTrack : this._nilTreeView.getLfmTrack(this._selectedRow);
    
    this._checkArtistIfFound();
    this._checkTrackIfFound();
    this._enableUpdateIfInLibrary();
    
    //todo disable text boxes until something is selected/auto select first item
  },
  
  onEditArtistInput: function(event) {
    this._checkArtistIfFound();
    this._enableUpdateIfInLibrary();
  },
  
  onUpdateNilSelection: function(event) {
    var guids = this._findSongInLibrary(this._artistField.value, this._trackField.value);
    if (guids.length > 0) { // should always be >0
      //todo use a function on the tree to get selected row
      this._nilTreeView.setLibInfo(this._selectedRow, this._artistField.value, this._trackField.value, guids);
      //todo refresh 
    }
  },

  onEditTrackInput: function(event) {
    this._checkTrackIfFound();
    this._enableUpdateIfInLibrary();
  },
  
  findOrStopPlayCounts: function() {
    if (this._processingFindButtonPress) {
      return;
    }
    
    this._startProcessingFindButtonPress();
    
    // If already finding then we must want to stop
    if (this._findingPlayCounts) {
      this._endFinding();
    }
    // Otherwise we want to start
    else {
      if (this._importingPlayCounts) {
        alert(this._strings.getString("findWhileImportingError"));
        this._endFinding();
        this._endProcessingFindButtonPress();
        return;
      }
  
      if (this._clearingPlayCounts) {
        alert(this._strings.getString("findWhileClearingError"));
        this._endFinding();
        this._endProcessingFindButtonPress();
        return;
      }

      var username = document.getElementById("last-fm-username-field").value;
      username = escape(username);

      if (username == null || username == "") {
        alert(this._strings.getString("noUsernameError"));
        this._endFinding();
        this._endProcessingFindButtonPress();
        return;
      }
      
      this._lastFmUsername = username;
        
      this._startFinding();
    }  
    
    this._endProcessingFindButtonPress();
  },
  
  doFindPlayCounts: function() {    
    if (this._curLibraryPage == 1) {      
      var response = this._getLibraryPage(this._lastFmUsername, 1);

      if (!this._findingPlayCounts) {
        return;
      }
      
      if (response == null) {
        alert(this._strings.getString("firstRequestFailedError"));
        this._endFinding();
        return;
      }
      
      this._totalLibraryPages = this._getLibraryTotalPages(response.responseXML);

      if (this._totalLibraryPages < 1) {
        alert(this._strings.getString("noLibraryPagesError"));
        this._endFinding();
        return;
      }
      
      this._processLibraryPage(response.responseXML);
      this._curLibraryPage = 2;
      setTimeout("PlayCountImporterDialog.Controller.doFindPlayCounts()", 0);
    }
    else if (this._curLibraryPage <= this._totalLibraryPages) {
      this._setStatus(this._strings.getFormattedString("gettingPlayCountProgressStatus", [this._curLibraryPage, this._totalLibraryPages],          
                      (this._curLibraryPage / this._totalLibraryPages) * 100));

      var response = this._getLibraryPage(this._lastFmUsername, this._curLibraryPage);

      if (response == null) {
        this._endFinding();
        return;        
      }

      if (!this._findingPlayCounts) {
        return;
      }

      this._processLibraryPage(response.responseXML);   
      this._curLibraryPage++;
      setTimeout("PlayCountImporterDialog.Controller.doFindPlayCounts()", 0);
    }
    else {
      this._clearStatus();
      alert(this._strings.getFormattedString("gettingPlayCountDone", [this._treeView.playCountArray.length]));
      this._endFinding();
    }
  },

  importPlayCounts: function() {
    if (this._findingPlayCounts) {
      this._strings.getString("importWhileFindingError");
      return;
    }
    
    if (this._importingPlayCounts) {
      this._strings.getString("importWhileImportingError");
      return;
    }  
  
    if (this._clearingPlayCounts) {
      this._strings.getString("importWhileClearingError");
      this._endFinding();
      this._endProcessingFindButtonPress();
      return;
    }
    
    if (this._treeView.playCountArray.length < 1) {
      this._strings.getString("nothingToImport");
      return;
    }
    
    answer = confirm(this._strings.getString("importConfirm"));

    if (answer != 0) {
      this._startImporting();
    }
  },
  
  doImportPlayCounts: function() {    
    var start = this._curImportCall * NUM_IMPORTS_PER_CALL;
    
    if (start < this._treeView.playCountArray.length)
    {
      this._setStatus(this._strings.getFormattedString("importingProgressStatus", [start == 0 ? 1 : start, this._treeView.playCountArray.length]), ((start+1) / this._treeView.playCountArray.length) * 100);
      
      var end = start + NUM_IMPORTS_PER_CALL;
      if (end > this._treeView.playCountArray.length) {
        end = this._treeView.playCountArray.length;
      }
      
      for (var index = start; index < end; index++) {
        if (this._treeView.playCountArray[index].importIt) {
          this._setPlayCounts(this._treeView.playCountArray[index].songGuids, this._treeView.playCountArray[index].playCount); 
        }
      }
      
      this._curImportCall++;
      setTimeout("PlayCountImporterDialog.Controller.doImportPlayCounts()", 0);
    }
    else
    {
      this._clearStatus();
      alert(this._strings.getFormattedString("importingDone", [this._numPlayCountsImported]));
      this._endImporting();
    }
  },
  
  clearPlayCounts: function() {
  
    if (this._findingPlayCounts) {
      alert(this._strings.getString("clearWhileFindingError"));
      return;
    }

    if (this._importingPlayCounts) {
      alert(this._strings.getString("clearWhileImportingError"));
      return;
    }  

    if (this._clearingPlayCounts) {
      alert(this._strings.getString("clearWhileClearingError"));
      this._endFinding();
      this._endProcessingFindButtonPress();
      return;
    }
    
    answer = confirm(this._strings.getString("clearConfirm"));

    if (answer == 0) {
      return;
    }
    
    this._startClearing();
  },
  
  doClearPlayCounts: function() {  	
  	var start = this._curClearCall * NUM_CLEARS_PER_CALL;
    
    if (start < LibraryUtils.mainLibrary.length) {
      this._setStatus(this._strings.getFormattedString("clearingProgressStatus", [start == 0 ? 1 : start, LibraryUtils.mainLibrary.length]), ((start+1) / LibraryUtils.mainLibrary.length) * 100);
      
      var end = start + NUM_CLEARS_PER_CALL;
      if (end > LibraryUtils.mainLibrary.length) {
        end = LibraryUtils.mainLibrary.length;
      }
      
      for (var index = start; index < end; index++) {
        var mediaItem = LibraryUtils.mainLibrary.getItemByIndex(index);
        mediaItem.setProperty(SBProperties.playCount, null);
      }
      
      this._curClearCall++;
      setTimeout("PlayCountImporterDialog.Controller.doClearPlayCounts()", 0);
    }
    else
    {
      this._clearStatus();
  	  alert(this._strings.getString("clearingDone"));
  	  this._endClearing();
    }
  },
  
  _startProcessingFindButtonPress: function() {
    this._processingFindButtonPress = true;
    this._disableButtons(true);
  },
  
  _endProcessingFindButtonPress: function() {
    this._processingFindButtonPress = false;
    this._findPlayCountsButton.setAttribute("disabled", "false");
  },
  
  _startFinding: function() {
    this._findingPlayCounts = true;
  
    this._disableButtons(false);
    this._findPlayCountsButton.setAttribute("label", this._strings.getString("findButtonStopLabel"));
    
    var resume = false;
    if (this._resumeCheckbox.getAttribute("checked") == "true" && this._resumeCheckbox.getAttribute("hidden") == "false") {
      resume = true;
    }
    this._hideResumeCheckbox();
    
    if (!resume) {
      this._clearPlayCountList();
      
      this._curLibraryPage = 1;
      this._totalLibraryPages = 1;
    }
    
    this._setStatus(this._strings.getString("startFindingStatusMessage"), -1);
    this._findPlayCountsButton.setAttribute("disabled", "true");
    
    setTimeout("PlayCountImporterDialog.Controller.doFindPlayCounts()", 0);
  },
    
  _endFinding: function() {
    this._findingPlayCounts = false;
    this._clearStatus();
    
    if (this._curLibraryPage == 1 || this._curLibraryPage > this._totalLibraryPages) {
      // Successfully finished or didn't start
      this._hideResumeCheckbox();
      
      this._curLibraryPage = 1;
      this._totalLibraryPages = 0;
    }
    else {
      // Something stopped it from finishing before the end      
      this._showResumeCheckbox();
    }
  
    this._enableButtons();
    this._findPlayCountsButton.setAttribute("label", this._strings.getString("findButtonSearchLabel"));
  },
  
  _hideResumeCheckbox: function() {
    this._resumeCheckbox.setAttribute("hidden", "true");
    this._resumeCheckbox.setAttribute("checked", "false");
  },

  _showResumeCheckbox: function() {
    this._resumeCheckbox.setAttribute("hidden", "false");
    this._resumeCheckbox.setAttribute("checked", "true");
  },
  
  _clearPlayCountList: function() {
    this._treeView.playCountArray = [];
    this._updateTreeViews();
  },
  
  _startImporting: function() {
    this._curImportCall = 0;
    this._importingPlayCounts = true;
    
    this._numPlayCountsImported = 0;
    
    this._onlyOverwriteIfGreater = document.getElementById("overwrite-if-greater-checkbox").getAttribute("checked") == "true";
    this._onlyOverwriteFirstMatch = document.getElementById("update-first-match-checkbox").getAttribute("checked") == "true";
    
    this._disableButtons(true);
    this._importPlayCountsButton.setAttribute("label", this._strings.getString("importButtonImportingLabel"));
    
    setTimeout("PlayCountImporterDialog.Controller.doImportPlayCounts()", 0);
  },
  
  _endImporting: function() {
    this._importingPlayCounts = false;
    this._clearStatus();
    
    this._enableButtons();
    this._importPlayCountsButton.setAttribute("label", this._strings.getString("importButtonImportLabel"));
  },
  
  _setPlayCounts: function(guids, playCount) {
    
    if (guids.length < 1) {
      return;
    }
    
    this._numPlayCountsImported++;
    
    if (this._onlyOverwriteFirstMatch) {
      // Find the song with the highest play count
      var maxPlayCount = -1;
      var songWithMaxPlayCount = null;
      for (var songIndex = 0; songIndex < guids.length; songIndex++) {
        var mediaItem = LibraryUtils.mainLibrary.getItemByGuid(guids[songIndex]);
        
        if (mediaItem.getProperty(SBProperties.playCount) > maxPlayCount) {
          maxPlayCount = mediaItem.getProperty(SBProperties.playCount);
          songWithMaxPlayCount = mediaItem;
        }
      }
      
      if (!this._onlyOverwriteIfGreater || playCount > maxPlayCount) {
        songWithMaxPlayCount.setProperty(SBProperties.playCount, playCount);
      }
    }
    // Overwriting all matches
    else {
      for (var songIndex = 0; songIndex < guids.length; songIndex++) {
        var mediaItem = LibraryUtils.mainLibrary.getItemByGuid(guids[songIndex]);
        
        if (!this._onlyOverwriteIfGreater || playCount > mediaItem.getProperty(SBProperties.playCount)) {
          mediaItem.setProperty(SBProperties.playCount, playCount);
        }
      }
    }    
  },
  
  _setStatus: function(text, progress) {
    var progressBar = document.getElementById("progress-meter");
    progressBar.setAttribute("hidden", text == "" ? "true" : "false");
    
    if (progress < 0) {
      progressBar.setAttribute("mode", "undetermined");
    }
    else {
      progressBar.setAttribute("mode", "determined");
      progressBar.setAttribute("value", progress);
    }
    
    var statusText = document.getElementById("status-label");
    statusText.setAttribute("label", text);
  },

  _clearStatus: function() {
    this._setStatus("", 0);
  },
  
  _getLibraryPage: function(username, page) {       
    var requestUri = LAST_FM_ROOT_URL + "?method=" + LIBRARY_GETTRACKS_METHOD + 
                        "&user=" + username +
                        "&page=" + page +
                        "&api_key=" + LAST_FM_API_KEY;

    var request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

    request.open("GET", requestUri, false);
    try {
    	request.send(null);
    }
    catch (e) {
      if (!this._findingPlayCounts) {
        return null;
      }
      
      Cu.reportError(e);
      alert(this._strings.getString("lastfmRequestError"));
      return null;
    }
    
    if (!this._findingPlayCounts) {
      return null;
    }
      
    if (!request.responseXML) {
      Cu.reportError(this._strings.getString("lastfmReponseError"));
      alert(this._strings.getString("lastfmReponseError"));
      return null; 
    }

    if (request.status != REQUEST_SUCCESS_CODE) {
      Cu.reportError(this._strings.getString("lastfmRequestUnsuccessfulError"));
      alert(this._strings.getString("lastfmRequestUnsuccessfulError"));
      return null;
    }
    
    return request;
  },

  _getLibraryTotalPages: function(xml) {
    var mainElement = xml.getElementsByTagName('tracks');
    if (mainElement == null || mainElement.length < 1 || !mainElement[0].hasAttribute("totalPages")) {
      return 0;
    }
    
    // Make sure there is at least one track
    var tracks = xml.getElementsByTagName('track');
    if (tracks.length < 1) {
      return 0;
    }
    
    return mainElement[0].getAttribute("totalPages");
  },
  
  _processLibraryPage: function(xml) {
    var tracks = xml.getElementsByTagName('track');
    
    for (var trackIndex = 0; trackIndex < tracks.length; trackIndex++) {
      if (!this._findingPlayCounts) {
        return;
      }
      
      var artistName = this._getArtistName(tracks[trackIndex]);
      var trackName = this._getTrackName(tracks[trackIndex]);
      var playCount = this._getPlayCount(tracks[trackIndex]);
      var songGuids = this._findSongInLibrary(artistName, trackName);
      
      if (songGuids.length > 0) {
        var newItem = {artistName: artistName, trackName: trackName, playCount: playCount, songGuids: songGuids, importIt: true};
        this._treeView.playCountArray.push(newItem);
      }
      else {
        var newItem = {lfmArtistName: artistName, lfmTrackName: trackName, libArtistName: "", libTrackName: "", playCount: playCount};
        this._nilTreeView.nilPlayCountArray.push(newItem);
      }
    }
    
    this._updateTreeViews();
  },
  
  _getArtistName: function(trackNode) {
    var artistElement = trackNode.getElementsByTagName('artist');
    if (artistElement == null || artistElement.length < 1) {
      return "";
    }
    
    var nameElement = artistElement[0].getElementsByTagName('name');
    if (nameElement == null || nameElement.length < 1) {
      return "";
    }
    
    return nameElement[0].textContent;
  },

  _getTrackName: function(trackNode) {
    var nameElement = trackNode.getElementsByTagName('name');
    if (nameElement == null || nameElement.length < 1) {
      return "";
    }
    
    return nameElement[0].textContent;
  },

  _getPlayCount: function(trackNode) {
    var playCountElement = trackNode.getElementsByTagName('playcount');
    if (playCountElement == null || playCountElement.length < 1) {
      return "";
    }
    
    return playCountElement[0].textContent;
  },
  
  _findSongInLibrary: function(artist, track) {
    var songProps = Cc["@songbirdnest.com/Songbird/Properties/MutablePropertyArray;1"]
     	                  .createInstance(Ci.sbIMutablePropertyArray);
    songProps.appendProperty(SBProperties.artistName, artist);  
    songProps.appendProperty(SBProperties.trackName, track);
    
    var guids = [];
    
    try {
    	var itemEnum = LibraryUtils.mainLibrary.getItemsByProperties(songProps).enumerate();
    	while (itemEnum.hasMoreElements()) {
      	var item = itemEnum.getNext();
    		guids.push(item.guid);
  		}
		}
  	catch (e) {
  	}
			
		return guids;
  },

  _findArtistInLibrary: function(artist) {
    try {
      var mediaItems = LibraryUtils.mainLibrary.getItemsByProperty(SBProperties.artistName, artist);
		  return mediaItems;
	  } 
	  catch (e) {
	    return null;
	  }
  },
  
  _findTrackInLibrary: function(track) {
    try {
      var mediaItems = LibraryUtils.mainLibrary.getItemsByProperty(SBProperties.trackName, track);
		  return mediaItems
    } 
    catch (e) {
      return null;
    }
  },
  
  _startClearing: function() {
    this._curClearCall = 0;
    this._clearingPlayCounts = true;
    
    this._disableButtons(true);
    this._clearPlayCountsButton.setAttribute("label", this._strings.getString("resetButtonResettingLabel"));
    
    this._setStatus(this._strings.getString("clearingPlayCountProgressStatus"), -1);
    
    setTimeout("PlayCountImporterDialog.Controller.doClearPlayCounts()", 1);
  },
  
  _endClearing: function() {
    this._clearingPlayCounts = false;
    this._clearStatus();
    
    this._enableButtons(true);
    this._clearPlayCountsButton.setAttribute("label", this._strings.getString("resetButtonResetLabel"));
  },
  
  _disableButtons: function(disableFindButton) {
    if (disableFindButton) {
      this._findPlayCountsButton.setAttribute("disabled", "true");
    }
    this._importPlayCountsButton.setAttribute("disabled", "true");
    this._clearPlayCountsButton.setAttribute("disabled", "true");
  },
  
  _enableButtons: function() {
    this._findPlayCountsButton.setAttribute("disabled", "false");
    this._importPlayCountsButton.setAttribute("disabled", "false");
    this._clearPlayCountsButton.setAttribute("disabled", "false");
  },
  
  _updateTreeViews: function() {
    this._treeView.update();
    document.getElementById("playcount-list").view = this._treeView;
    this._nilTreeView.update();
    document.getElementById("not-in-library-list").view = this._nilTreeView;
  },
  
  //todo change name
  _checkArtistIfFound: function() {
    var items = null;
    if (this._artistField.value.length > 0) {
      items = this._findArtistInLibrary(this._artistField.value);
    }
    this._artistCheck.setAttribute("checked", items != null && items.length > 0 ? "true" : "false");
    
    this._updateTrackSuggestionList(items);
  },
  
  _updateTrackSuggestionList: function(artistTracks) {
    var trackList = document.getElementById("edit-track-list");
    
    while (trackList.firstChild) {
      trackList.removeChild(trackList.firstChild);
    }
    
    //todo add dummy item/disable list if nothing found
    //todo check if the track is already in the in-library list
    
    var foundTracks = [];
    
    try {
    	var itemEnum = artistTracks.enumerate();
    	while (itemEnum.hasMoreElements()) {
      	var item = itemEnum.getNext();
      	var track = item.getProperty(SBProperties.trackName);
      	
      	//if (!(foundTracks.findIndex(track) )) {
      	  foundTracks[track] = 1;
      	
      	  var trackItem = document.createElement("menuitem");
          trackItem.setAttribute("label", track);
          trackList.appendChild(trackItem);
        //}
  		}
		}
  	catch (e) {
  	}
  },
  
  _checkTrackIfFound: function() {
    //todo check for empty
    var items = this._findTrackInLibrary(this._trackField.value);
    this._trackCheck.setAttribute("checked", items != null && items.length > 0 ? "true" : "false");
    
    var artistList = document.getElementById("edit-artist-list");
    
    while (artistList.firstChild) {
      artistList.removeChild(artistList.firstChild);
    }
    
    try {
    	var itemEnum = items.enumerate();
    	while (itemEnum.hasMoreElements()) {
      	var item = itemEnum.getNext();
      	var artist = item.getProperty(SBProperties.artistName);
      	
      	var artistItem = document.createElement("menuitem");
        artistItem.setAttribute("label", artist);
        artistList.appendChild(artistItem);
  		}
		}
  	catch (e) {
  	}
  },
  
  _enableUpdateIfInLibrary: function() {
    //todo check for empty
    //todo disable button if nothing selected
    //todo disable if it is the same as what is in the list already
    var guids = this._findSongInLibrary(this._artistField.value, this._trackField.value);
    this._updateButton.setAttribute("disabled", guids.length > 0 ? "false" : "true");
  }
};

window.addEventListener("load", function(e) { PlayCountImporterDialog.Controller.onLoad(e); }, false);
window.addEventListener("unload", function(e) { PlayCountImporterDialog.Controller.onUnLoad(e); }, false);