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
Cu.import("resource://app/jsmodules/ArrayConverter.jsm");
Cu.import("resource://app/jsmodules/SBJobUtils.jsm");

// Make a namespace.
if (typeof PlayCountImporterDialog == 'undefined') {
  var PlayCountImporterDialog = {};
}

const VI_LAST_FM_ROOT_URL = "http://ws.audioscrobbler.com/2.0/";
const VI_LAST_FM_API_KEY = "72b14fe3e1fd7f8ff8a993b1f1e78a50";

const VI_LIBRARY_GETTRACKS_METHOD = "library.getTracks";

const VI_REQUEST_SUCCESS_CODE = 200

const NUM_IMPORTS_PER_CALL = 50;
const NUM_CLEARS_PER_CALL = 200;

PlayCountImporterDialog.Controller = {
  onLoad: function() {
    var controller = this;
    this._strings = document.getElementById("vandelay-industries-strings");
        
    this._defaultUsername = "";
    try {
      var lastFMService = Cc['@songbirdnest.com/lastfm;1']
                            .getService().wrappedJSObject;
      this._defaultUsername = lastFMService.username;
    }
    catch (e) {}
    
    //this._runTextMatchTests();
                            
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
        hiddenPlayCountArray: [],
        rowCount: 0,
        getCellText : function(row,column) {  
          if (column.id == "nil-lfm-artist-column") return this.getLfmArtist(row);
          else if (column.id == "nil-lfm-title-column") return this.getLfmTrack(row);
          else if (column.id == "nil-lib-artist-column") return this.getLibArtist(row);
          else if (column.id == "nil-lib-title-column") return this.getLibTrack(row);
          else if (column.id == "nil-play-count-column") return this.nilPlayCountArray[row].playCount;
          else return "";  
        },  
        setTree: function(treebox) { this.treebox = treebox; },  
        isContainer: function(row) { return false; },  
        isSeparator: function(row) { return false; },  
        isSorted: function() { return false; },  
        getLevel: function(row) { return 0; },  
        getImageSrc: function(row,col) { return null; },  
        getRowProperties: function(row,props) {},  
        getCellProperties: function(row,col,props) {
          if (col.id == "nil-lib-artist-column") {
            var aserv = Cc["@mozilla.org/atom-service;1"].getService(Components.interfaces.nsIAtomService);
            
            var lfmArtist = this.getLfmArtist(row);
            var libArtist = this.getLibArtist(row);
            
            if (lfmArtist.length == libArtist.length && lfmArtist.toLowerCase().indexOf(libArtist.toLowerCase()) != -1) {
              props.AppendElement(aserv.getAtom("matchedText"));              
            }
            else {
              props.AppendElement(aserv.getAtom("unmatchedText"));
            }            
          }
          else if (col.id == "nil-lib-title-column") {
            var aserv = Cc["@mozilla.org/atom-service;1"].getService(Components.interfaces.nsIAtomService);
            
            var lfmTrack = this.getLfmTrack(row);
            var libTrack = this.getLibTrack(row);
            
            if (lfmTrack.length == libTrack.length && lfmTrack.toLowerCase().indexOf(libTrack.toLowerCase()) != -1) {
              props.AppendElement(aserv.getAtom("matchedText"));              
            }
            else {
              props.AppendElement(aserv.getAtom("unmatchedText"));
            }
          }
        },        
        getColumnProperties: function(colid,col,props) {}, 
        update: function() { this.rowCount = this.nilPlayCountArray.length; }, 
        getLfmArtist: function(row) { return row >= 0 && row < this.nilPlayCountArray.length ? this.nilPlayCountArray[row].lfmArtistName : null; },
        getLfmTrack: function(row) { return row >= 0 && row < this.nilPlayCountArray.length ? this.nilPlayCountArray[row].lfmTrackName : null; },
        getLibArtist: function(row) { return row >= 0 && row < this.nilPlayCountArray.length ? this.nilPlayCountArray[row].libArtistName : null; },
        getLibTrack: function(row) { return row >= 0 && row < this.nilPlayCountArray.length ? this.nilPlayCountArray[row].libTrackName : null; },
        setLibInfo: function(row, artist, track, guids) { 
          this.nilPlayCountArray[row].libArtistName = artist;
          this.nilPlayCountArray[row].libTrackName = track;
          this.nilPlayCountArray[row].songGuids = guids; 
          this.treebox.invalidateRow(row);
        },
        removeItem: function(row) { 
          if (row >= 0 && row < this.nilPlayCountArray.length) {
            this.nilPlayCountArray.splice(row,1);
            this.update();
            this.treebox.invalidate();
          }
        },
        isEditable: function(row,col) { return true; },
        getCellValue: function(row,col) { return this.nilPlayCountArray[row].importIt ? "true" : "false"; },
        setCellValue: function(row,col,string) { this.nilPlayCountArray[row].importIt = (string == "true" ? true : false); this.treebox.invalidateRow(row); }
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
         
    this._onlyOverwriteIfGreaterCheck = document.getElementById("overwrite-if-greater-checkbox");
    this._onlyOverwriteIfGreaterCheck.addEventListener("command", 
          function() { controller.onOverwriteIfGreaterChecked(); }, false);
    this._addToExistingPlayCountCheck = document.getElementById("add-to-existing-playcount-checkbox");
    this._addToExistingPlayCountCheck.addEventListener("command", 
          function() { controller.onAddToExistingChecked(); }, false);
    this._onlyOverwriteFirstMatchCheck = document.getElementById("update-first-match-checkbox");
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
    
    this._inLibraryTabPanel = document.getElementById("in-library-tab-panel");
    this._notInLibraryTabPanel = document.getElementById("not-in-library-tab-panel");
    this._updateTabPanelTitles();
    
    this._inLibraryTree = document.getElementById("playcount-list");
    this._notInLibraryTree = document.getElementById("not-in-library-list");
    
    this._artistField = document.getElementById("edit-artist-textbox");
    this._artistCheck = document.getElementById("edit-artist-checkbox");
    this._trackField = document.getElementById("edit-track-textbox");
    this._trackCheck = document.getElementById("edit-track-checkbox");
    this._showFixedCheck = document.getElementById("show-fixed-checkbox");
    this._nilSelectAllCheck = document.getElementById("nil-select-all-checkbox");
    this._ilSelectAllCheck = document.getElementById("il-select-all-checkbox");
    
    // Disabled since I can't stop the tree from scrolling to the top after a remove
    /*
    this._removeButton = document.getElementById("remove-button");
    this._removeButton.addEventListener("command", 
          function() { controller.onRemoveNilSelection(); }, false);
    */
          
    this._autoFixButton = document.getElementById("auto-fix-button");
    this._autoFixButton.addEventListener("command", 
          function() { controller.onAutoFixNilTree(); }, false);
    this._autoFixSelectedButton = document.getElementById("auto-fix-single-button");
    this._autoFixSelectedButton.addEventListener("command", 
          function() { controller.onAutoFixSelected(); }, false);
    this._undoFixesButton = document.getElementById("undo-fixes-button");
    this._undoFixesButton.addEventListener("command", 
          function() { controller.onUndoFixes(); }, false);
      
    this._globallyFixArtistCheck = document.getElementById("globally-fix-artist-checkbox");
    this._fixMetadataButton = document.getElementById("fix-metadata-button");
    this._fixMetadataButton.addEventListener("command", 
          function() { controller.onFixMetadata(); }, false);
    this._saveToFileButton = document.getElementById("save-to-file-button");
    this._saveToFileButton.addEventListener("command", 
          function() { controller.onSaveToFile(); }, false);
          
    this._selectedRow = -1;
    this._fixedArtists = [];
  },
  
  fakePopulate: function() {
    this._treeView.playCountArray.push({artistName: "artistName", trackName: "trackName", playCount: 1, songGuids: ["a", "b"], importIt: true});
    this._treeView.playCountArray.push({artistName: "artistName2", trackName: "trackName", playCount: 2, songGuids: ["a"], importIt: false});
    this._nilTreeView.nilPlayCountArray.push({lfmArtistName: "artistName3", lfmTrackName: "trackName", libArtistName: "", libTrackName: "", playCount: 3, importIt: true});
    this._updateTreeViews();
  },

  onUnLoad: function() {
  },
  
  // These two check boxes are mutually exclusive
  onOverwriteIfGreaterChecked: function(event) {
    var checked = this._onlyOverwriteIfGreaterCheck.getAttribute("checked") == "true";
    if (checked) {
      this._addToExistingPlayCountCheck.setAttribute("checked", "false");
    }
  },
  
  onAddToExistingChecked: function(event) {
    var checked = this._addToExistingPlayCountCheck.getAttribute("checked") == "true";
    if (checked) {
      this._onlyOverwriteIfGreaterCheck.setAttribute("checked", "false");
    }    
  },
  
  onUsernameKeypress: function(event) {
    if (event.keyCode == 13) {
      PlayCountImporterDialog.Controller.findOrStopPlayCounts();
    }
    
    this._hideResumeCheckbox();
  },
  
  onNilTreeSelection: function(event) {
    this._selectedRow = event.target.currentIndex;
    this._updateNilTreeAfterSelection();
  },
  
  onEditArtistInput: function(event) {
    this._artistTextHasChanged();
  },
  
  onRemoveNilSelection: function(event) {
    var selectedIndex = this._notInLibraryTree.currentIndex;
    this._nilTreeView.removeItem(selectedIndex);
    this._nilTreeView.selection.select(selectedIndex);
    this._notInLibraryTree.view = this._nilTreeView;
    this._updateNilTreeAfterSelection();
    this._updateTabPanelTitles();
  },
  
  onAutoFixNilTree: function(event) {
    answer = confirm(this._strings.getString("autoFixConfirm"));

    if (answer != 0) {
      this._autoFixNotInLibrary();
    }
  },
  
  onAutoFixSelected: function(event) {
    var selectedIndex = this._notInLibraryTree.currentIndex;
    this._autoFixRow(selectedIndex);
    selectedIndex++;
    this._nilTreeView.selection.select(selectedIndex);
  },
  
  onUndoFixes: function(event) {
    var combinedArrays = this._nilTreeView.nilPlayCountArray.concat(this._nilTreeView.hiddenPlayCountArray);
    for (var index = 0; index < combinedArrays.length; ++index) {
      combinedArrays[index].libArtistName = "";
      combinedArrays[index].libTrackName = "";
      combinedArrays[index].songGuids = null; 
      this._nilTreeView.treebox.invalidate();
    }
  },

  onEditTrackInput: function(event) {
    this._trackTextHasChanged();
  },
  
  onShowFixedCheckCommand: function(event) {
    var checked = this._showFixedCheck.getAttribute("checked") == "true";
    if (checked) {
      this._showAllNilRows();
    }
    else {
      this._hideFixedlNilRows();
    }
  },
  
  onNilSelectAll: function(event) {
    var checked = this._nilSelectAllCheck.getAttribute("checked") == "true";
    this._selectAllRows(true, checked);
  },
  
  onIlSelectAll: function(event) {
    var checked = this._ilSelectAllCheck.getAttribute("checked") == "true";
    this._selectAllRows(false, checked);
  },

  onFixMetadata: function(event) {
    answer = confirm(this._strings.getString("fixMetadataConfirm"));

    if (answer == 0) {
      return;
    }

    this._startFixMetadata();
  },
  
  doFixMetadata: function() {
    
    if (this._fixMetadataCall < 0 || this._fixMetadataCall >= this._combinedFixMetadataArrays.length) {
  	  this._endFixMetadata();
    }
    else {
      this._setStatus(this._strings.getFormattedString("fixMetadataStatus", [this._fixMetadataCall+1, this._combinedFixMetadataArrays.length]), ((this._fixMetadataCall+1) / this._combinedFixMetadataArrays.length) * 100);
      
      var curItem = this._combinedFixMetadataArrays[this._fixMetadataCall];
      
      if (curItem.importIt == true && curItem.songGuids != null && curItem.songGuids.length > 0) 
      {
        for (var songIndex = 0; songIndex < curItem.songGuids.length; songIndex++) {
          var mediaItem = LibraryUtils.mainLibrary.getItemByGuid(curItem.songGuids[songIndex]);
          mediaItem.setProperty(SBProperties.trackName, curItem.lfmTrackName);
          mediaItem.setProperty(SBProperties.artistName, curItem.lfmArtistName);
          this._numSongsUpdated++;
        }

        if (this._globallyFixArtists
           && 
           // artist is different
           (curItem.lfmArtistName.length != curItem.libArtistName.length || curItem.lfmArtistName.toLowerCase().indexOf(curItem.libArtistName.toLowerCase()) == -1)) {
             
          var tracksFromArtist = VandelayIndustriesShared.Functions.findArtistInLibrary(curItem.libArtistName);

          if (tracksFromArtist != null) {
            try {
            	var trackEnum = tracksFromArtist.enumerate();
            	while (trackEnum.hasMoreElements()) {
              	var item = trackEnum.getNext();
              	item.setProperty(SBProperties.artistName, curItem.lfmArtistName);
              	this._numSongsUpdated++;
              }
            }
            catch (e) {
            }

          }
        }
      }
        
      this._fixMetadataCall++;
      setTimeout("PlayCountImporterDialog.Controller.doFixMetadata()", 0);
    }
  },
  
  onSaveToFile: function(){
    answer = confirm(this._strings.getString("saveToFileConfirm"));

    if (answer == 0) {
      return;
    }
    
    var saveAllFiles = document.getElementById("save-all-files-checkbox").getAttribute("checked") == "true";
    
    var mediaItemArray = Components.classes["@songbirdnest.com/moz/xpcom/threadsafe-array;1"].createInstance(Components.interfaces.nsIMutableArray);
    
    if (saveAllFiles) {
      for (var index = 0; index < LibraryUtils.mainLibrary.length; index++) {
        var mediaItem = LibraryUtils.mainLibrary.getItemByIndex(index);
        if (LibraryUtils.canEditMetadata(mediaItem)) {
          mediaItemArray.appendElement(mediaItem, false);
        }
      }
    }
    else {
      var combinedArrays = this._nilTreeView.nilPlayCountArray.concat(this._nilTreeView.hiddenPlayCountArray);
      for (var index = 0; index < combinedArrays.length; index++) {
        var curItem = combinedArrays[index];
        if (curItem.songGuids != null && curItem.songGuids.length > 0) {
          for (var guidIndex = 0; guidIndex < curItem.songGuids.length; guidIndex++) {
            var mediaItem = LibraryUtils.mainLibrary.getItemByGuid(curItem.songGuids[guidIndex]);
            if (LibraryUtils.canEditMetadata(mediaItem)) {
              mediaItemArray.appendElement(mediaItem, false);
            }
          }
        }
      }
    }
    
    if (mediaItemArray.length > 0) {
      var service = Components.classes["@songbirdnest.com/Songbird/FileMetadataService;1"].getService(Components.interfaces.sbIFileMetadataService);
      try {
        var properties = new Array();
        properties.push(SBProperties.trackName);
        properties.push(SBProperties.artistName);
        properties.push(SBProperties.genre); // Need to re-save this because of a bug with numbered genres - e.g. Rock turns into "17 Rock" for some reason
          
        var propArray = ArrayConverter.stringEnumerator(properties);
        var job = service.write(mediaItemArray, propArray);

        SBJobUtils.showProgressDialog(job, window, 0);
      } catch (e) {
        Components.utils.reportError(e);
      }
    }
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
      //username = escape(username);

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
        this._endFinding();
        return;
      }
      
      //alert(response.responseText);
      
      this._totalLibraryPages = this._getLibraryTotalPages(response.responseXML);
      
      // _totalLibraryPages can be 0 or 1 for play counts under 50, but this will work in either case
      // There is a problem with getting a library with 50-70ish tracks, last.fm just says there is 1 page.
      
      this._processLibraryPage(response.responseXML);
      this._curLibraryPage = 2;
      setTimeout("PlayCountImporterDialog.Controller.doFindPlayCounts()", 0);
    }
    else if (this._curLibraryPage <= this._totalLibraryPages) {
      this._setStatus(this._strings.getFormattedString("gettingPlayCountProgressStatus", [this._curLibraryPage, this._totalLibraryPages]),          
                      ((this._curLibraryPage / this._totalLibraryPages) * 100));

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
      if (this._treeView.playCountArray.length == 0 && this._nilTreeView.nilPlayCountArray.length == 0) {
        alert(this._strings.getString("gettingPlayCountDoneNoneFound"));
      }
      else if (this._nilTreeView.nilPlayCountArray.length == 0) {
        alert(this._strings.getFormattedString("gettingPlayCountDoneAllFound", [this._treeView.playCountArray.length]));
      }
      else {
        alert(this._strings.getFormattedString("gettingPlayCountDoneNotAllFound", [this._treeView.playCountArray.length, this._nilTreeView.nilPlayCountArray.length]));
      }
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
    
    var combinedArrays = this._treeView.playCountArray.concat(this._nilTreeView.nilPlayCountArray);
    combinedArrays = combinedArrays.concat(this._nilTreeView.hiddenPlayCountArray);
    
    if (start < combinedArrays.length)
    {
      this._setStatus(this._strings.getFormattedString("importingProgressStatus", [start == 0 ? 1 : start, combinedArrays.length]), ((start+1) / combinedArrays.length) * 100);
      
      var end = start + NUM_IMPORTS_PER_CALL;
      if (end > combinedArrays.length) {
        end = combinedArrays.length;
      }
      
      for (var index = start; index < end; index++) {
        if (combinedArrays[index].importIt ) {
          this._setPlayCounts(combinedArrays[index].songGuids, combinedArrays[index].playCount); 
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
  
  sortInLibList: function(column) {
    this.doSort(column, "in-library");
  },
  
  sortNotInLibList: function(column) {
    this.doSort(column, "not-in-library");
  },
  
  doSort: function(column, tree) {
    if (tree == "in-library") {
      var theTree = this._inLibraryTree;
      var theArray = this._treeView.playCountArray;
    }
    else if (tree == "not-in-library") {
      var theTree = this._notInLibraryTree;
      var theArray = this._nilTreeView.nilPlayCountArray;
    }
    else {
      return;
    }
    
    var columnName;
    var order = theTree.getAttribute("sortDirection") == "ascending" ? 1 : -1;
    //if the column is passed and it's already sorted by that column, reverse sort
    if (column) {
    	columnName = column.id;
    	if (theTree.getAttribute("sortResource") == columnName) {
    		order *= -1;
    	}
    } else {
    	columnName = theTree.getAttribute("sortResource");
    }
    
    theTree.setAttribute("sortDirection", order == 1 ? "ascending" : "descending");
    theTree.setAttribute("sortResource", columnName);
    //set the appropriate attributes to show to indicator
    var cols = theTree.getElementsByTagName("treecol");
    for (var i = 0; i < cols.length; i++) {
    	cols[i].removeAttribute("sortDirection");
    }
    document.getElementById(columnName).setAttribute("sortDirection", order == 1 ? "ascending" : "descending");
    
    // Actually sort the data    
    this.sortOrder = order;
    switch (columnName)
    {
      case "artist-column":
        theArray.sort(this.sortByArtist);
        break;
      case "title-column":
        theArray.sort(this.sortByTrack);
        break;
      case "play-count-column":
        theArray.sort(this.sortByPlayCount);
        break;
      case "in-library-column":
        theArray.sort(this.sortByInLibrary);
        break;
      case "import-column":
        theArray.sort(this.sortByImport);
        break;
      case "nil-lfm-artist-column":
        theArray.sort(this.sortByLfmArtist);
        break;
      case "nil-lfm-title-column":
        theArray.sort(this.sortByLfmTrack);
        break;
      case "nil-lib-artist-column":
        theArray.sort(this.sortByLibArtist);
        break;
      case "nil-lib-title-column":
        theArray.sort(this.sortByLibTrack);
        break;
      case "nil-play-count-column":
        theArray.sort(this.sortByNilPlayCount);
        break;
      case "nil-import-column":
        theArray.sort(this.sortByNilImport);
        break;
    }
    
    if (tree == "in-library") {
      this._inLibraryTree.view = this._treeView;
    }
    else if (tree == "not-in-library") {
      this._notInLibraryTree.view = this._nilTreeView;
    }
    
    this._updateNilTreeAfterSelection();
  },
  
  sortByArtist: function(a, b) {
    if (a.artistName.toLowerCase() < b.artistName.toLowerCase()) return 1 * PlayCountImporterDialog.Controller.sortOrder;
    if (a.artistName.toLowerCase() > b.artistName.toLowerCase()) return -1 * PlayCountImporterDialog.Controller.sortOrder;
    //tie breaker: track is the second level sort
    if (a.trackName.toLowerCase() < b.trackName.toLowerCase()) return 1 * PlayCountImporterDialog.Controller.sortOrder;
    if (a.trackName.toLowerCase() > b.trackName.toLowerCase()) return -1 * PlayCountImporterDialog.Controller.sortOrder;
    return 0;
  },
  
  sortByTrack: function(a, b) {
    if (a.trackName.toLowerCase() < b.trackName.toLowerCase()) return 1 * PlayCountImporterDialog.Controller.sortOrder;
    if (a.trackName.toLowerCase() > b.trackName.toLowerCase()) return -1 * PlayCountImporterDialog.Controller.sortOrder;
    //tie breaker: artist is the second level sort
    if (a.artistName.toLowerCase() < b.artistName.toLowerCase()) return 1 * PlayCountImporterDialog.Controller.sortOrder;
    if (a.artistName.toLowerCase() > b.artistName.toLowerCase()) return -1 * PlayCountImporterDialog.Controller.sortOrder;
    return 0;
  },

  sortByPlayCount: function(a, b) {
    if (a.playCount * 1 > b.playCount * 1) return 1 * PlayCountImporterDialog.Controller.sortOrder;
    if (a.playCount * 1 < b.playCount * 1) return -1 * PlayCountImporterDialog.Controller.sortOrder;
    //tie breaker: artist/track is the second level sort
    return PlayCountImporterDialog.Controller.sortByArtist(b, a);
  },
  
  sortByInLibrary: function(a, b) {
    if (a.songGuids.length < b.songGuids.length) return 1 * PlayCountImporterDialog.Controller.sortOrder;
    if (a.songGuids.length > b.songGuids.length) return -1 * PlayCountImporterDialog.Controller.sortOrder;
    //tie breaker: artist/track is the second level sort
    return PlayCountImporterDialog.Controller.sortByArtist(b, a);
  },
  
  sortByImport: function(a, b) {
    if (a.importIt < b.importIt) return 1 * PlayCountImporterDialog.Controller.sortOrder;
    if (a.importIt > b.importIt) return -1 * PlayCountImporterDialog.Controller.sortOrder;
    //tie breaker: artist/track is the second level sort
    return PlayCountImporterDialog.Controller.sortByArtist(b, a);
  },
  
  sortByLfmArtist: function(a, b) {
    if (a.lfmArtistName.toLowerCase() < b.lfmArtistName.toLowerCase()) return 1 * PlayCountImporterDialog.Controller.sortOrder;
    if (a.lfmArtistName.toLowerCase() > b.lfmArtistName.toLowerCase()) return -1 * PlayCountImporterDialog.Controller.sortOrder;
    //tie breaker: lfm track is the second level sort
    if (a.lfmTrackName.toLowerCase() < b.lfmTrackName.toLowerCase()) return 1 * PlayCountImporterDialog.Controller.sortOrder;
    if (a.lfmTrackName.toLowerCase() > b.lfmTrackName.toLowerCase()) return -1 * PlayCountImporterDialog.Controller.sortOrder;
    return 0;    
  },
  
  sortByLfmTrack: function(a, b) {
    if (a.lfmTrackName.toLowerCase() < b.lfmTrackName.toLowerCase()) return 1 * PlayCountImporterDialog.Controller.sortOrder;
    if (a.lfmTrackName.toLowerCase() > b.lfmTrackName.toLowerCase()) return -1 * PlayCountImporterDialog.Controller.sortOrder;
    //tie breaker: lfm track is the second level sort
    if (a.lfmArtistName.toLowerCase() < b.lfmArtistName.toLowerCase()) return 1 * PlayCountImporterDialog.Controller.sortOrder;
    if (a.lfmArtistName.toLowerCase() > b.lfmArtistName.toLowerCase()) return -1 * PlayCountImporterDialog.Controller.sortOrder;
    return 0;
  },
  
  sortByLibArtist: function(a, b) {
    if (a.libArtistName.toLowerCase() < b.libArtistName.toLowerCase()) return 1 * PlayCountImporterDialog.Controller.sortOrder;
    if (a.libArtistName.toLowerCase() > b.libArtistName.toLowerCase()) return -1 * PlayCountImporterDialog.Controller.sortOrder;
    //tie breaker: lfm track is the second level sort
    if (a.libTrackName.toLowerCase() < b.libTrackName.toLowerCase()) return 1 * PlayCountImporterDialog.Controller.sortOrder;
    if (a.libTrackName.toLowerCase() > b.libTrackName.toLowerCase()) return -1 * PlayCountImporterDialog.Controller.sortOrder;
    return 0;
  },
  
  sortByLibTrack: function(a, b) {
    if (a.libTrackName.toLowerCase() < b.libTrackName.toLowerCase()) return 1 * PlayCountImporterDialog.Controller.sortOrder;
    if (a.libTrackName.toLowerCase() > b.libTrackName.toLowerCase()) return -1 * PlayCountImporterDialog.Controller.sortOrder;
    //tie breaker: lfm track is the second level sort
    if (a.libArtistName.toLowerCase() < b.libArtistName.toLowerCase()) return 1 * PlayCountImporterDialog.Controller.sortOrder;
    if (a.libArtistName.toLowerCase() > b.libArtistName.toLowerCase()) return -1 * PlayCountImporterDialog.Controller.sortOrder;
    return 0;
  },

  sortByNilPlayCount: function(a, b) {
    if (a.playCount * 1 > b.playCount * 1) return 1 * PlayCountImporterDialog.Controller.sortOrder;
    if (a.playCount * 1 < b.playCount * 1) return -1 * PlayCountImporterDialog.Controller.sortOrder;
    //tie breaker: artist/track is the second level sort
    return PlayCountImporterDialog.Controller.sortByLfmArtist(b, a);
  },

  sortByNilImport: function(a, b) {
    if (a.importIt < b.importIt) return 1 * PlayCountImporterDialog.Controller.sortOrder;
    if (a.importIt > b.importIt) return -1 * PlayCountImporterDialog.Controller.sortOrder;
    //tie breaker: artist/track is the second level sort
    return PlayCountImporterDialog.Controller.sortByLfmArtist(b, a);
  },
  
  _updateNilTreeAfterSelection: function() {
    var libArtist = this._nilTreeView.getLibArtist(this._selectedRow);
    this._artistField.value = libArtist != null && libArtist.length > 0 ? libArtist : this._nilTreeView.getLfmArtist(this._selectedRow);

    var libTrack = this._nilTreeView.getLibTrack(this._selectedRow);
    this._trackField.value = libTrack != null && libTrack.length > 0 ? libTrack : this._nilTreeView.getLfmTrack(this._selectedRow);

    this._artistTextHasChanged();
    this._trackTextHasChanged();
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
    this._nilTreeView.nilPlayCountArray = [];
    this._updateTreeViews();
  },
  
  _startImporting: function() {
    this._curImportCall = 0;
    this._importingPlayCounts = true;
    
    this._numPlayCountsImported = 0;
    
    this._onlyOverwriteIfGreater = this._onlyOverwriteIfGreaterCheck.getAttribute("checked") == "true";
    this._addToExistingPlayCount = this._addToExistingPlayCountCheck.getAttribute("checked") == "true";
    this._onlyOverwriteFirstMatch = this._onlyOverwriteFirstMatchCheck.getAttribute("checked") == "true";
    
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
        var playCountToUse = parseInt(playCount);
        
        if (this._addToExistingPlayCount && songWithMaxPlayCount.getProperty(SBProperties.playCount) != null) {
          playCountToUse += parseInt(songWithMaxPlayCount.getProperty(SBProperties.playCount));
        }
        
        songWithMaxPlayCount.setProperty(SBProperties.playCount, playCountToUse);
      }
    }
    // Overwriting all matches
    else {
      for (var songIndex = 0; songIndex < guids.length; songIndex++) {
        var mediaItem = LibraryUtils.mainLibrary.getItemByGuid(guids[songIndex]);
        
        if (!this._onlyOverwriteIfGreater || playCount > mediaItem.getProperty(SBProperties.playCount)) {
          var playCountToUse = parseInt(playCount);

          if (this._addToExistingPlayCount && mediaItem.getProperty(SBProperties.playCount) != null) {
            playCountToUse += parseInt(mediaItem.getProperty(SBProperties.playCount));
          }
          
          mediaItem.setProperty(SBProperties.playCount, playCountToUse);
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
    var requestUri = VI_LAST_FM_ROOT_URL + "?method=" + VI_LIBRARY_GETTRACKS_METHOD + 
                        "&user=" + username +
                        "&page=" + page +
                        "&api_key=" + VI_LAST_FM_API_KEY;

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

    if (request.status != VI_REQUEST_SUCCESS_CODE) {
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
      
      var artistName = VandelayIndustriesShared.Functions.getArtistName(tracks[trackIndex]);
      var trackName = VandelayIndustriesShared.Functions.getTrackName(tracks[trackIndex]);
      var playCount = VandelayIndustriesShared.Functions.getPlayCount(tracks[trackIndex]);
      var songGuids = VandelayIndustriesShared.Functions.findSongInLibrary(artistName, trackName);
      
      if (songGuids.length > 0) {
        var newItem = {artistName: artistName, trackName: trackName, playCount: playCount, songGuids: songGuids, importIt: true};
        this._treeView.playCountArray.push(newItem);
      }
      else {
        var newItem = {lfmArtistName: artistName, lfmTrackName: trackName, libArtistName: "", libTrackName: "", playCount: playCount, importIt: true, songGuids: []};
        this._nilTreeView.nilPlayCountArray.push(newItem);
      }
    }
    
    this._updateTreeViews();
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
    this._fixMetadataButton.setAttribute("disabled", "true");
    this._saveToFileButton.setAttribute("disabled", "true");
    this._clearPlayCountsButton.setAttribute("disabled", "true");
    
    //this._artistField.setAttribute("disabled", "true");
    //this._trackField.setAttribute("disabled", "true");
    //this._removeButton.setAttribute("disabled", "true");
    this._autoFixButton.setAttribute("disabled", "true");
    this._autoFixSelectedButton.setAttribute("disabled", "true");
    this._undoFixesButton.setAttribute("disabled", "true");
    this._showFixedCheck.setAttribute("disabled", "true");
    
    this._inLibraryTree.setAttribute("disabled", "true");
    this._notInLibraryTree.setAttribute("disabled", "true");
  },
  
  _enableButtons: function() {
    this._findPlayCountsButton.setAttribute("disabled", "false");
    this._importPlayCountsButton.setAttribute("disabled", "false");
    this._fixMetadataButton.setAttribute("disabled", "false");
    this._saveToFileButton.setAttribute("disabled", "false");
    this._clearPlayCountsButton.setAttribute("disabled", "false");
    
    //this._artistField.setAttribute("disabled", "false");
    //this._trackField.setAttribute("disabled", "false");
    //this._artistField.setAttribute("editable", "true");
    //this._trackField.setAttribute("editable", "true");
    //this._removeButton.setAttribute("disabled", "false");
    this._autoFixButton.setAttribute("disabled", "false");
    this._autoFixSelectedButton.setAttribute("disabled", "false");
    this._undoFixesButton.setAttribute("disabled", "false");
    this._showFixedCheck.setAttribute("disabled", "false");
    
    this._inLibraryTree.setAttribute("disabled", "false");
    this._notInLibraryTree.setAttribute("disabled", "false");
  },
  
  _updateTreeViews: function() {
    this._treeView.update();
    this._inLibraryTree.view = this._treeView;
    this._nilTreeView.update();
    this._notInLibraryTree.view = this._nilTreeView;
    this._updateTabPanelTitles();
    this.sortInLibList(null);
    this.sortNotInLibList(null);
  },
  
  _artistTextHasChanged: function() {
    var items = null;
    if (this._artistField.value.length > 0) {
      items = VandelayIndustriesShared.Functions.findArtistInLibrary(this._artistField.value);
    }
    this._artistCheck.setAttribute("checked", items != null && items.length > 0 ? "true" : "false");
    
    this._updateTrackSuggestionList(items);
    
    // if the artist was found, go through the rest of the list and update all artists with the same name
    var lfmArtist = this._nilTreeView.getLfmArtist(this._selectedRow);
    var libArtist = this._nilTreeView.getLibArtist(this._selectedRow);
    var newArtist = this._artistField.value;
    // Paranoid check to make sure the artist name has just been updated
    if (items != null && items.length > 0 && lfmArtist != null && newArtist != null && lfmArtist.length > 0 && newArtist.length > 0 && lfmArtist != newArtist && libArtist.length == 0) {
      this._updateAllRowsWithThisArtist(lfmArtist, newArtist);
    }
    
    this._updateSelectedNilTrack();    
  },
  
  _updateTrackSuggestionList: function(artistTracks) {
    var trackList = document.getElementById("edit-track-list");
    
    while (trackList.firstChild) {
      trackList.removeChild(trackList.firstChild);
    }
    
    var foundTracks = [];
    var weightedTracks = [];
    var lfmTrackName = this._nilTreeView.getLfmTrack(this._selectedRow);
    
    try {
    	var itemEnum = artistTracks.enumerate();
    	while (itemEnum.hasMoreElements()) {
      	var item = itemEnum.getNext();
      	var track = item.getProperty(SBProperties.trackName);
        
      	if (foundTracks[track] == null || foundTracks[track] != true) {
      	  foundTracks[track] = true;
      	  
          var curTrackScore = VandelayIndustriesShared.Functions.getDifferenceScore(track, lfmTrackName);
          weightedTracks.push({trackName: track, score: curTrackScore});
        }
  		}
		}
  	catch (e) {
  	}
  	
  	function sortByScore(a, b) {
      // If score is really bad, just sort by name
      if (a.score < -5 && b.score < -5) {
        return a.trackName.toLowerCase() > b.trackName.toLowerCase();
      }
  	  return a.score < b.score;
  	}
  	
  	weightedTracks.sort(sortByScore);
  	
  	for (var index=0; index < weightedTracks.length; index++) {
  	  var trackItem = document.createElement("menuitem");
      trackItem.setAttribute("label", weightedTracks[index].trackName);
      trackList.appendChild(trackItem);
  	}
  },
  
  _trackTextHasChanged: function() {
    var items = null;
    if (this._trackField.value.length > 0) {
      items = VandelayIndustriesShared.Functions.findTrackInLibrary(this._trackField.value);
    }
    
    this._trackCheck.setAttribute("checked", items != null && items.length > 0 ? "true" : "false");
    
    var artistList = document.getElementById("edit-artist-list");
    
    while (artistList.firstChild) {
      artistList.removeChild(artistList.firstChild);
    }
    
    var foundArtists = [];
    var weightedArtists = [];
        
    var lfmArtistName = this._nilTreeView.getLfmArtist(this._selectedRow);
    
    // Add any previously fixed artists
    if (this._fixedArtists[lfmArtistName] != null) {
      var fixedArtist = this._fixedArtists[lfmArtistName];
      foundArtists[fixedArtist] = true;
      weightedArtists.push({artistName: fixedArtist, score: 100});
    }
    
    try {
    	var itemEnum = items.enumerate();
    	while (itemEnum.hasMoreElements()) {
      	var item = itemEnum.getNext();
      	var artist = item.getProperty(SBProperties.artistName);
      	if (foundArtists[artist] == null || foundArtists[artist] != true) {
      	  foundArtists[artist] = true;
      	
          // Give each potential artist a score
          var curArtistScore = VandelayIndustriesShared.Functions.getDifferenceScore(artist, lfmArtistName);
          weightedArtists.push({artistName: artist, score: curArtistScore});
      	}
      }
    }
  	catch (e) {
  	}

    function sortByScore(a, b) {
      // If score is really bad, just sort by name
      if (a.score < -5 && b.score < -5) {
        return a.artistName.toLowerCase() > b.artistName.toLowerCase();
      }
      
  	  return a.score < b.score;
  	}

  	weightedArtists.sort(sortByScore);

  	for (var index=0; index < weightedArtists.length; index++) {
      var artistItem = document.createElement("menuitem");
      artistItem.setAttribute("label", weightedArtists[index].artistName);
      artistList.appendChild(artistItem);
  	}
  	
    this._updateSelectedNilTrack();
  },
  
  _runTextMatchTests: function() {
    var resultsString = "Text Match Tests\n";
    
    resultsString += this._testTextMatch("exact", "exact", 100);
    
    resultsString += this._testTextMatch("CAPS", "caps", 99);
    resultsString += this._testTextMatch("CApS", "cApS", 99);
    
    resultsString += this._testTextMatch("  strip  ", "strip", 98);
    resultsString += this._testTextMatch("  strip", "strip", 98);
    resultsString += this._testTextMatch("strip  ", "     strip", 98);
    resultsString += this._testTextMatch("strip strip", "stripstrip", 98);   
    resultsString += this._testTextMatch("strIp StriP", "stripstrip", 98); 
    
    resultsString += this._testTextMatch("belle & sebastian", " Belle AND Sebastian  ", 97);
    resultsString += this._testTextMatch("belle and sebastian ", "Belle & Sebastian  ", 97);
    
    resultsString += this._testTextMatch("n.e.r.d.", "N*E*R*D", 96);
    resultsString += this._testTextMatch("Heart's a mess", "Hearts a Mess", 96);
    resultsString += this._testTextMatch("abcd`~!@#$%^*-=_+\\|;:,./?*(){}[]<>'\"", "a[bcd^]^$@<#$!@(>#'$%)#?\":\\,.+*=/-+", 96);
    resultsString += this._testTextMatch("!@#$", "@#$", -1);
    
    resultsString += this._testTextMatch("Bombtrack", "bombtrack (live)", 95);
    resultsString += this._testTextMatch("(he'll never be an) ol' man river", "ol man river", 95);
    resultsString += this._testTextMatch("Bombtrack", "bombtrack [live]", 95);
    resultsString += this._testTextMatch("Bombtrack", "bombtrack {live}", 95);
    resultsString += this._testTextMatch("Bombtrack", "bombtrack <live>", 95);
    
    resultsString += this._testTextMatch("Damian \"jr. gong\" marley", "Damian Marley", 94);
    resultsString += this._testTextMatch("Damian 'jr. gong' marley", "Damian Marley", 94);
    resultsString += this._testTextMatch("Damian 'jr. gong' marley", "Damian Marley!!", 94);
    
    resultsString += this._testTextMatch("The Doves", "Doves", 93);
    resultsString += this._testTextMatch("Doves", "Doves, The", 93);
    resultsString += this._testTextMatch("Doves", "Doves,The", 93);
    resultsString += this._testTextMatch("There There", "re There", -3); // Fix this later?
    resultsString += this._testTextMatch("They writhe", "y wri", -4); // Fix this later?
    resultsString += this._testTextMatch("Walk The Dog", "Walk Dog", -3);
    
    resultsString += this._testTextMatch("03 - song name", "song name", 92);
    resultsString += this._testTextMatch("song name", "song name which is a remix", 92);
    
    resultsString += this._testTextMatch("song", "soong", -1);
    resultsString += this._testTextMatch("song", "sng", -1);
    resultsString += this._testTextMatch("song", "snog", -1);
    resultsString += this._testTextMatch("song", "somg", -1);
    resultsString += this._testTextMatch("something", "different", -8);
    resultsString += this._testTextMatch("ab", "different", -9);
    resultsString += this._testTextMatch("different", "ab", -9);
    
    
    alert(resultsString);
  },
  
  _testTextMatch: function(string1, string2, expectedScore) {
    var score = VandelayIndustriesShared.Functions.getDifferenceScore(string1, string2);
    var match = score == expectedScore;
    var restultText = match ? "WIN! " : "FAIL! ";
    restultText += string1 + " & " + string2 + (match ? " == " : " = " + score + " != ") + expectedScore + "\n";
    return restultText;
  },
  
  _updateSelectedNilTrack: function() {
    var guids = VandelayIndustriesShared.Functions.findSongInLibrary(this._artistField.value, this._trackField.value);
    if (guids.length > 0) {
      this._nilTreeView.setLibInfo(this._selectedRow, this._artistField.value, this._trackField.value, guids);
      
      if (this._showFixedCheck.getAttribute("checked") != "true") {
        this._hideFixedlNilRows();
      }
    }
  },
  
  _updateTabPanelTitles: function() {
    var inLibraryTabTitle = this._strings.getString("inLibraryTabPanelLabel");
    var numInLibraryItems = this._treeView.playCountArray.length;
    if (numInLibraryItems > 0) {
      inLibraryTabTitle = inLibraryTabTitle + " (" + numInLibraryItems + ")";
    }
    this._inLibraryTabPanel.setAttribute("label", inLibraryTabTitle);
    
    var notInLibraryTabTitle = this._strings.getString("notInLibraryTabPanelLabel");
    var numNotInLibraryItems = this._nilTreeView.nilPlayCountArray.length;
    var numHiddenNotInLibraryItems = this._nilTreeView.hiddenPlayCountArray.length;
    if (numNotInLibraryItems > 0 || numHiddenNotInLibraryItems > 0) {
      notInLibraryTabTitle = notInLibraryTabTitle + " (" + numNotInLibraryItems;
      if (numHiddenNotInLibraryItems > 0) {
        notInLibraryTabTitle += " + " + numHiddenNotInLibraryItems + " Hidden";
      }
      notInLibraryTabTitle += ")";
    }
    this._notInLibraryTabPanel.setAttribute("label", notInLibraryTabTitle);
  },
  
  _showAllNilRows: function() {         
    this._nilTreeView.nilPlayCountArray = this._nilTreeView.nilPlayCountArray.concat(this._nilTreeView.hiddenPlayCountArray);
    this._nilTreeView.hiddenPlayCountArray = [];
    this._updateTreeViews();
  },
  
  _hideFixedlNilRows: function() {
    var index = 0;
    while (index < this._nilTreeView.nilPlayCountArray.length) {
      if (this._nilTreeView.nilPlayCountArray[index].libArtistName.length > 0 && this._nilTreeView.nilPlayCountArray[index].libTrackName.length > 0) {
        this._nilTreeView.hiddenPlayCountArray.splice(this._nilTreeView.hiddenPlayCountArray.length, 0, this._nilTreeView.nilPlayCountArray[index]);
        this._nilTreeView.nilPlayCountArray.splice(index, 1);
      }
      else {
        index++;
      }
    }
    this._updateTreeViews();
    this._updateNilTreeAfterSelection();
  },
  
  _selectAllRows: function(nil, selected) {
    var array = nil ? this._nilTreeView.nilPlayCountArray : this._treeView.playCountArray;
  
    for (var index = 0; index < array.length; index++) {
      array[index].importIt = selected;
    }
    
    this._updateTreeViews();
  },
  
  _updateAllRowsWithThisArtist: function(oldArtist, newArtist) {
      for (var index = 0; index < this._nilTreeView.nilPlayCountArray.length; index++) {
        // If it matches the replaced artist name and we can find a track with the exact name, then fix it
        if (this._nilTreeView.getLfmArtist(index) == oldArtist && (this._nilTreeView.getLibArtist(index) == null || this._nilTreeView.getLibArtist(index).length == 0)) {
          var guids = VandelayIndustriesShared.Functions.findSongInLibrary(newArtist, this._nilTreeView.getLfmTrack(index));
          if (guids.length > 0) {
            this._nilTreeView.setLibInfo(index, newArtist, this._nilTreeView.getLfmTrack(index), guids);
            // _hideFixedlNilRows will be called later
          }
        }
      }
  },
  
  _autoFixNotInLibrary: function() {    
    // Go through all the rows that aren't fixed and try to fix the artist or track
    for (var index = 0; index < this._nilTreeView.nilPlayCountArray.length; index++) {
      if (index < this._nilTreeView.nilPlayCountArray.length && (this._nilTreeView.nilPlayCountArray[index].songGuids == null || this._nilTreeView.nilPlayCountArray[index].songGuids.length == 0)) {
        this._autoFixRow(index);
      }
    }
    
    if (this._showFixedCheck.getAttribute("checked") != "true") {
      this._hideFixedlNilRows();
    }
  },
  
  _autoFixRow: function(index) {
    var trackAtIndex = this._nilTreeView.nilPlayCountArray[index].lfmTrackName;
    var artistAtIndex = this._nilTreeView.nilPlayCountArray[index].lfmArtistName;
    
    // Quick check to see if we have already fixed this artist
    if (this._fixedArtists[artistAtIndex] != null) {
        var guids = VandelayIndustriesShared.Functions.findSongInLibrary(this._fixedArtists[artistAtIndex], trackAtIndex);
        if (guids.length > 0) {
          this._nilTreeView.setLibInfo(index, this._fixedArtists[artistAtIndex], trackAtIndex, guids);
          return;
        }
    }
    
    var tracksMatchingName = VandelayIndustriesShared.Functions.findTrackInLibrary(trackAtIndex);
    var artistsMatchingName = VandelayIndustriesShared.Functions.findArtistInLibrary(artistAtIndex);
    
    // If we can't find an artist or track, try with a previously fixed artist
    if (tracksMatchingName == null && artistsMatchingName == null && this._fixedArtists[artistAtIndex] != null) {
      artistAtIndex = this._fixedArtists[artistAtIndex];
      artistsMatchingName = VandelayIndustriesShared.Functions.findArtistInLibrary(artistAtIndex);
    }
    
    var bestArtist = "";
    var bestArtistScore = -1000;
    
    try {
    	var trackEnum = tracksMatchingName.enumerate();
    	while (trackEnum.hasMoreElements()) {
      	var trackItem = trackEnum.getNext();
      	var artist = trackItem.getProperty(SBProperties.artistName);
        var curArtistScore = VandelayIndustriesShared.Functions.getDifferenceScore(artist, artistAtIndex);
      	
      	if (curArtistScore > bestArtistScore) {
      	  bestArtist = artist;
      	  bestArtistScore = curArtistScore;
      	}
      }
    }
    catch (e) {
    }
    
    var bestTrack = "";
    var bestTrackScore = -1000;
    
    try {
    	var artistEnum = artistsMatchingName.enumerate();
    	while (artistEnum.hasMoreElements()) {
      	var artistItem = artistEnum.getNext();
      	var track = artistItem.getProperty(SBProperties.trackName);
        var curTrackScore = VandelayIndustriesShared.Functions.getDifferenceScore(track, trackAtIndex);
      	
      	if (curTrackScore > bestTrackScore) {
      	  bestTrack = track;
      	  bestTrackScore = curTrackScore;
      	}
      }
    }
    catch (e) {
    }
    
    if 
    (
      // If there was an artist match and no track match
      (bestArtistScore > -1000 && bestTrackScore == -1000)
      || 
      // Or if there was a decent artist match
      bestArtistScore > 0
      || 
      // Or the artist match was better than the track match
      (bestArtistScore > -1000 && bestArtistScore > bestTrackScore)
    ) 
    {
      // Make sure the match was actually something
      if 
      (
          bestArtistScore > 0 
          || 
          // put an upper limit of 5 changes
          (bestArtistScore >= -5 && ((bestArtistScore*-1 < bestArtist.length/2) && (bestArtistScore*-1 < artistAtIndex.length/2)))
      ) 
      {
        var guids = VandelayIndustriesShared.Functions.findSongInLibrary(bestArtist, trackAtIndex);
        if (guids.length > 0) 
        {
          this._nilTreeView.setLibInfo(index, bestArtist, trackAtIndex, guids);
          this._fixedArtists[artistAtIndex] = bestArtist;
        }
      }
    }
    else if (bestTrackScore > -1000) 
    {
      if 
      (
          bestTrackScore > 0 
          || 
          // put an upper limit of 5 changes
          (bestTrackScore >= -5 && ((bestTrackScore*-1 < bestTrack.length/2) && (bestTrackScore*-1 < trackAtIndex.length/2)))
      ) 
      {
        var guids = VandelayIndustriesShared.Functions.findSongInLibrary(artistAtIndex, bestTrack);
        if (guids.length > 0) 
        {
          this._nilTreeView.setLibInfo(index, artistAtIndex, bestTrack, guids);
        }
      }
    }
  },
  
  _startFixMetadata: function() {
    
    this._globallyFixArtists = this._globallyFixArtistCheck.getAttribute("checked") == "true";
    
    this._combinedFixMetadataArrays = this._nilTreeView.nilPlayCountArray.concat(this._nilTreeView.hiddenPlayCountArray);
    this._numSongsUpdated = 0;
    this._fixMetadataCall = 0;
    
    this._disableButtons(true);
    
    this._setStatus(this._strings.getString("fixingMetadataProgressStatus"), -1);
    
    setTimeout("PlayCountImporterDialog.Controller.doFixMetadata()", 1);
  },
  
  _endFixMetadata: function() {
    if (this._numSongsUpdated == 0) {
      alert(this._strings.getString("fixMetadataErrorNoSongs"));
    }
    else {
      alert(this._strings.getFormattedString("fixMetadataSuccess", [this._numSongsUpdated]));
    }
    
    this._enableButtons(true);
    this._clearStatus();
  },
  
};

window.addEventListener("load", function(e) { PlayCountImporterDialog.Controller.onLoad(e); }, false);
window.addEventListener("unload", function(e) { PlayCountImporterDialog.Controller.onUnLoad(e); }, false);