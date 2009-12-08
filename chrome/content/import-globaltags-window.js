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
if (typeof ImportGlobalTagsDialog == 'undefined') {
  var ImportGlobalTagsDialog = {};
}

const VI_LAST_FM_ROOT_URL = "http://ws.audioscrobbler.com/2.0/";
const VI_LAST_FM_API_KEY = "72b14fe3e1fd7f8ff8a993b1f1e78a50";

const VI_REQUEST_SUCCESS_CODE = 200

const ALBUM_ARTIST_TAG_PLAYLIST_PROP = "vandelay-industries_album-artist-tag-";
const ALBUM_TAG_PLAYLIST_PROP = "vandelay-industries_album-tag-";
const ARTIST_TAG_PLAYLIST_PROP = "vandelay-industries_artist-tag-";

ImportGlobalTagsDialog.Controller = {
  onLoad: function() {
    var controller = this;
    this._strings = document.getElementById("vandelay-industries-strings");
    
    this._importTagsForAlbumArtistChoice = document.getElementById("import-tags-for-album-artist");
    //this._importTagsForAlbumChoice = document.getElementById("import-tags-for-album");
    this._importTagsForArtistChoice = document.getElementById("import-tags-for-artist");
    this._deleteOldPlaylistsButton = document.getElementById("delete-old-playlists-button");
    this._deleteOldPlaylistsButton.addEventListener("command", 
          function() { controller.onDeleteOldPlaylistsButton(); }, false);
    
    this._filterActionIgnoreChoice = document.getElementById("filter-action-ignore");
    this._filterActionOnlyChoice = document.getElementById("filter-action-only");
    
    this._addTagMenu = document.getElementById("add-tag-menu");
    this._addTagMenu.addEventListener("command", 
          function() { controller.onAddTagMenuChange(); }, false);
    this._addTagTextboxLabel = document.getElementById("add-tag-textbox-label");
    this._addTagTextbox = document.getElementById("add-tag-textbox");
    this._addTagChoice = document.getElementById("add-tag-choice");
    this._addTopTagsChoice = document.getElementById("add-top-tags-choice");
    this._addCommonIgnoreChoice = document.getElementById("add-common-ignore-choice");
    this._addTagButton = document.getElementById("add-tag-button");
    this._addTagButton.addEventListener("command", 
          function() { controller.onAddTagButton(); }, false);
    this._removeSelectedTagButton = document.getElementById("remove-selected-tag-button");
    this._removeSelectedTagButton.addEventListener("command", 
          function() { controller.onRemoveSelectedTagButton(); }, false);
    this._removeAllTagsButton = document.getElementById("remove-all-tags-button");
    this._removeAllTagsButton.addEventListener("command", 
          function() { controller.onRemoveAllTagsButton(); }, false);
          
    this._findXTagsTextbox = document.getElementById("find-x-tags-textbox");
    this._findTagsButton = document.getElementById("find-tags-button");
    this._findTagsButton.addEventListener("command", 
          function() { controller.onFindTagsButton(); }, false);
          
    this._importTagsButton = document.getElementById("import-tags-button");
    this._importTagsButton.addEventListener("command", 
          function() { controller.onImportTags(); }, false);
          
    //this._groupByItemRadio = document.getElementById("group-by-item-radio");
    //this._groupByItemRadio.setAttribute("label", this._strings.getString("groupByAlbumArtist"));
    //this._groupByTagRadio = document.getElementById("group-by-tag-radio");
          
    this._tagFilterTreeView = {  
        dataArray: [],
        rowCount: 0,
        treeSet: false,
        getCellText : function(row,column) {  
          if (column.id == "filter-tag-name-column") return this.getTagName(row);
          else return "";  
        },  
        setTree: function(treebox) { this.treebox = treebox; this.treeSet = true; },  
        isContainer: function(row) { return false; },  
        isSeparator: function(row) { return false; },  
        isSorted: function() { return false; },  
        getLevel: function(row) { return 0; },  
        getImageSrc: function(row,col) { return null; },  
        getRowProperties: function(row,props) {},  
        getCellProperties: function(row,col,props) {},        
        getColumnProperties: function(colid,col,props) {}, 
        update: function() { this.rowCount = this.dataArray.length; }, 
        getTagName: function(row) { return row >= 0 && row < this.dataArray.length ? this.dataArray[row].filteredTagName : null; },
        addTag: function(tagName) { 
          tagName = tagName.toLowerCase();
          
          // Make sure it's not already in the list
          for (var i = 0; i < this.dataArray.length; i++) {
            var curTagName = this.dataArray[i].filteredTagName;
            if (curTagName.toLowerCase() == tagName) {
              return;
            }
          }
          
          var oldLength = this.dataArray.length;
          this.dataArray.push({filteredTagName: tagName});
          if (this.treeSet) {
            this.treebox.invalidateRow(oldLength);
          }
          this.rowCount = oldLength + 1;
        },
        removeItem: function(row) { 
          if (row >= 0 && row < this.dataArray.length) {
            this.dataArray.splice(row,1);
            this.update();
            if (this.treeSet) {
              this.treebox.invalidate();
            }
          }
          if (this.selection) {
            this.selection.clearSelection();
          }
        },
        removeSelected: function() {
          for (var i = this.dataArray.length - 1; i >= 0; i--) {
            if (this.selection.isSelected(i)) {
              this.dataArray.splice(i,1);
            }
          } 
          if (this.selection) {
            this.selection.clearSelection();
          }
          if (this.treeSet) {
            this.treebox.invalidate();
          }
        },
        clear: function() { 
          if (this.selection) {
            this.selection.clearSelection();
          }
          this.dataArray = [];
          this.rowCount = 0;
        },
    };
    
    this._tagFilterTree = document.getElementById("tag-filter-tree");
    this.tagFilterSortOrder = -1;
    this._addCommonIgnoreTagsToFilter();
    this._updateTagFilterTreeView();
    
    this._tagResultsTagTreeView = {  
        dataArray: [],
        rowCount: 0,
        treeSet: false,
        getCellText : function(row,column) {  
          if (column.id == "import-tag-name-column") return this.getTagName(row);
          else return "";  
        },  
        setTree: function(treebox) { this.treebox = treebox; this.treeSet = true; },  
        isContainer: function(row) { return false; },  
        isSeparator: function(row) { return false; },  
        isSorted: function() { return false; },  
        getLevel: function(row) { return 0; },  
        getImageSrc: function(row,col) { return null; },  
        getRowProperties: function(row,props) {},  
        getCellProperties: function(row,col,props) {},        
        getColumnProperties: function(colid,col,props) {},
        getCellValue: function(row,col) { return this.getImportTagByRow(row) ? "true" : "false"; },
        setCellValue: function(row,col,string) { this.setImportTag(row, (string == "true" ? true : false)); this.treebox.invalidateRow(row); },
        isEditable: function(row,col) { return col.id == "import-tag-checkbox-column"; },
        update: function() { this.rowCount = this.dataArray.length; }, 
        getTagName: function(row) { return row >= 0 && row < this.dataArray.length ? this.dataArray[row].tagName : null; },
        addTag: function(tagName) {
          var oldLength = this.dataArray.length;
          this.dataArray.push({tagName: tagName, importTag: this.getImportTagByName(tagName)});
          if (this.treeSet) {
            this.treebox.invalidateRow(oldLength);
          }
          this.rowCount = oldLength + 1;
        },
        clear: function() { 
          if (this.selection) {
            this.selection.clearSelection();
          }
          this.dataArray = [];
          this.rowCount = 0;
        },
        getImportTagByRow: function(row) {
          var tagName = this.dataArray[row].tagName;
          return this.getImportTagByName(tagName);
        },
        getImportTagByName: function(tagName) {
          return controller._tagsToImportDict[tagName];
        },
        setImportTag: function(row, importTag) {
          var tagName = this.dataArray[row].tagName;
          if (controller._tagsToImportDict[tagName]) {
            controller._tagsToImportDict[tagName] = importTag;
          }
        },
    };
    
    this._tagResultsItemTreeView = {  
        dataArray: [],
        rowCount: 0,
        treeSet: false,
        getCellText : function(row,column) {  
          if (column.id == "import-item-lib-name-column") return this.getItemName(row);
          else return "";  
        },  
        setTree: function(treebox) { this.treebox = treebox; this.treeSet = true; },  
        isContainer: function(row) { return false; },  
        isSeparator: function(row) { return false; },  
        isSorted: function() { return false; },  
        getLevel: function(row) { return 0; },  
        getImageSrc: function(row,col) { return null; },  
        getRowProperties: function(row,props) {},  
        getCellProperties: function(row,col,props) {},        
        getColumnProperties: function(colid,col,props) {},
        getCellValue: function(row,col) { 
          var tagName = controller.getSelectedTag();
          var itemName = this.getItemName(row);
          
          if (tagName && tagName.length > 0 && itemName && itemName.length > 0) {
            return this.getImportItemByName(tagName, itemName);
          }
        },
        setCellValue: function(row,col,string) { 
          var tagName = controller.getSelectedTag();
          var itemName = this.getItemName(row);
          
          if (tagName && tagName.length > 0 && itemName && itemName.length > 0) {
            this.setImportItemByName(tagName, itemName, (string == "true" ? true : false));
          }
        },
        isEditable: function(row,col) { return col.id == "import-item-column"; },
        update: function() { this.rowCount = this.dataArray.length; }, 
        getItemName: function(row) { return row >= 0 && row < this.dataArray.length ? this.dataArray[row].itemName : null; },
        addItem: function(itemName) {
          var oldLength = this.dataArray.length;
          var tagName = controller.getSelectedTag();
          
          if (tagName && tagName.length > 0) {
            this.dataArray.push({itemName: itemName, importItem: this.getImportItemByName(tagName, itemName)});
            if (this.treeSet) {
              this.treebox.invalidateRow(oldLength);
            }
            this.rowCount = oldLength + 1;
          }
        },
        clear: function() { 
          if (this.selection) {
            this.selection.clearSelection();
          }
          this.dataArray = [];
          this.rowCount = 0;
        },
        getImportItemByName: function(tagName, itemName) {
          if (!controller._tagToItemDict[tagName]) return false;
          return controller._tagToItemDict[tagName][itemName];
        },
        setImportItemByName: function(tagName, itemName, importItem) {
          if (!controller._tagToItemDict[tagName]) return;
          controller._tagToItemDict[tagName][itemName] = importItem;
        },
    };
    
    this._tagsToImport = [];
    this._tagsToImportDict = {};
    //this._itemsToImport = [];
    //this._itemsToImportDict = {};
    this._tagToItem = {};
    this._tagToItemDict = {};
    //this._itemToTag = {};
    this._tagResultsTagTree = document.getElementById("tag-tree");
    this.tagResultsTagTreeSortOrder = -1;
    this._updateTagResultsTagTree();
    this._tagResultsItemTree = document.getElementById("item-tree");
    this.tagResultsItemTreeSortOrder = -1;
    this._updateTagResultsItemTree();
    
    this._updateStatus("", -1);
    
    this._updateAddTagTextboxLabel();
    
    this._propMan = Cc["@songbirdnest.com/Songbird/Properties/PropertyManager;1"].getService(Ci.sbIPropertyManager);
  },
  
  onUnLoad: function() {
  },

  onDeleteOldPlaylistsButton: function() {
    if (this._importTagsForAlbumArtistChoice.selected) {
      var playlistPropToDelete = ALBUM_ARTIST_TAG_PLAYLIST_PROP;
    }
    /*
    else if (this._importTagsForAlbumChoice.selected) {
      var playlistPropToDelete = ALBUM_TAG_PLAYLIST_PROP;
    }
    */
    else if (this._importTagsForArtistChoice.selected) {
      var playlistPropToDelete = ARTIST_TAG_PLAYLIST_PROP;
    }
    else {
      return;
    }
    
    try 
    {
      var listener = {  
        onEnumerationBegin: function(aMediaList) {},  
        onEnumeratedItem: function(aMediaList, aMediaItem) {
    			customType = aMediaItem.getProperty(SBProperties.customType);
  			  if (customType.indexOf(playlistPropToDelete) == 0) {
  			    LibraryUtils.mainLibrary.remove(aMediaItem);
  			  }
        },  
        onEnumerationEnd: function(aMediaList, aStatusCode) {}  
      };
      
      LibraryUtils.mainLibrary.enumerateItemsByProperty(SBProperties.isList, "1", listener);
  	} 
  	catch (e if e.result == Cr.NS_ERROR_NOT_AVAILABLE) {}
  },
  
  onAddTagMenuChange: function(event) {
    this._updateAddTagTextboxLabel();
  },
  
  _updateAddTagTextboxLabel: function() {
    if (this._addTagChoice.selected) {
      this._addTagTextboxLabel.setAttribute("hidden", "false");
      this._addTagTextbox.setAttribute("hidden", "false");
      this._addTagTextboxLabel.value = this._strings.getString("addTag");
      this._addTagTextbox.removeAttribute("type");
      this._addTagTextbox.removeAttribute("min");
      this._addTagTextbox.removeAttribute("max");
      this._addTagTextbox.removeAttribute("increment");
      this._addTagTextbox.setAttribute("value", "");
    }
    else if (this._addTopTagsChoice.selected) {
      this._addTagTextboxLabel.setAttribute("hidden", "false");
      this._addTagTextbox.setAttribute("hidden", "false");
      this._addTagTextboxLabel.value = this._strings.getString("numberToAdd"); 
      this._addTagTextbox.setAttribute("type", "number");
      this._addTagTextbox.setAttribute("min", "1");
      this._addTagTextbox.setAttribute("max", "250");
      this._addTagTextbox.setAttribute("increment", "1");
      this._addTagTextbox.setAttribute("value", "25");
    }
    else if (this._addCommonIgnoreChoice.selected) {
      this._addTagTextboxLabel.setAttribute("hidden", "true");
      this._addTagTextbox.setAttribute("hidden", "true");
    }
  },
  
  onAddTagButton: function(event) {
    if (this._addTagChoice.selected) {
      var newTagName = this._addTagTextbox.value;
      if (newTagName && newTagName.length > 0) {
        this._tagFilterTreeView.addTag(newTagName);
      }
    }
    else if (this._addTopTagsChoice.selected) {
      var numToAdd = parseInt(this._addTagTextbox.value);
      if (numToAdd > 0) {
        this._addTopTagsToFilter(numToAdd);
      }
    }
    else if (this._addCommonIgnoreChoice.selected) {
      this._addCommonIgnoreTagsToFilter();
    }
    
    this._updateTagFilterTreeView();
    this._tagFilterTreeView.dataArray.sort(this.sortTagFilterByName);
  },
  
  _addCommonIgnoreTagsToFilter: function() {
    this._tagFilterTreeView.addTag("albums i own");
    this._tagFilterTreeView.addTag("amazing");
    this._tagFilterTreeView.addTag("awesome");
    this._tagFilterTreeView.addTag("favorite");
    this._tagFilterTreeView.addTag("favorite songs");
    this._tagFilterTreeView.addTag("favorites");
    this._tagFilterTreeView.addTag("favourite");
    this._tagFilterTreeView.addTag("favourite songs");
    this._tagFilterTreeView.addTag("favourites");
    this._tagFilterTreeView.addTag("good");
    this._tagFilterTreeView.addTag("heard on pandora");
    this._tagFilterTreeView.addTag("loved");
    this._tagFilterTreeView.addTag("seen live");
  },
  
  _updateTagFilterTreeView: function() {
    this._tagFilterTreeView.update();
    this._tagFilterTree.view = this._tagFilterTreeView;
  },
  
  onRemoveSelectedTagButton: function() {
    this._tagFilterTreeView.removeSelected();
    this._updateTagFilterTreeView();
  },
  
  onRemoveAllTagsButton: function() {
    this._tagFilterTreeView.clear();
    this._updateTagFilterTreeView();
  },
  
  sortTagFilterList: function(column) {
    var columnName;
    var order = this._tagFilterTree.getAttribute("sortDirection") == "ascending" ? 1 : -1;
    //if the column is passed and it's already sorted by that column, reverse sort
    if (column) {
    	columnName = column.id;
    	if (this._tagFilterTree.getAttribute("sortResource") == columnName) {
    		order *= -1;
    	}
    } else {
    	columnName = this._tagFilterTree.getAttribute("sortResource");
    }
    
    this._tagFilterTree.setAttribute("sortDirection", order == 1 ? "ascending" : "descending");
    this._tagFilterTree.setAttribute("sortResource", columnName);
    //set the appropriate attributes to show to indicator
    var cols = this._tagFilterTree.getElementsByTagName("treecol");
    for (var i = 0; i < cols.length; i++) {
    	cols[i].removeAttribute("sortDirection");
    }
    document.getElementById(columnName).setAttribute("sortDirection", order == 1 ? "ascending" : "descending");
    
    // Actually sort the data    
    this.tagFilterSortOrder = order;
    switch (columnName)
    {
      case "filter-tag-name-column":
        this._tagFilterTreeView.dataArray.sort(this.sortTagFilterByName);
        break;
    }
    
    this._updateTagFilterTreeView();
  },
  
  sortTagFilterByName: function(a, b) {
    if (a.filteredTagName.toLowerCase() < b.filteredTagName.toLowerCase()) return 1 * ImportGlobalTagsDialog.Controller.tagFilterSortOrder;
    if (a.filteredTagName.toLowerCase() > b.filteredTagName.toLowerCase()) return -1 * ImportGlobalTagsDialog.Controller.tagFilterSortOrder;
    return 0;
  },
  
  _addTopTagsToFilter: function(numToAdd) {
    var requestUri = VI_LAST_FM_ROOT_URL + "?method=tag.getTopTags" + 
                        "&api_key=" + VI_LAST_FM_API_KEY;

    var request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
    
    request.open("GET", requestUri, false);
    try {
    	request.send(null);
    }
    catch (e) {
      Cu.reportError(e);
      alert(this._strings.getString("lastfmRequestError"));
      return;
    }
    
    if (!request.responseXML) {
      Cu.reportError(this._strings.getString("lastfmReponseError"));
      alert(this._strings.getString("lastfmReponseError"));
      return; 
    }

    if (request.status != VI_REQUEST_SUCCESS_CODE) {
      Cu.reportError(this._strings.getString("lastfmRequestUnsuccessfulError"));
      alert(this._strings.getString("lastfmRequestUnsuccessfulError"));
      return;
    }
    
    var xml = request.responseXML;
    var tagNames = xml.getElementsByTagName('name');

    for (var tagNameIndex = 0; tagNameIndex < tagNames.length && tagNameIndex < numToAdd; tagNameIndex++) {      
      var tagName = tagNames[tagNameIndex].textContent;
      this._tagFilterTreeView.addTag(tagName);
    }
  },
  
  onFindTagsButton: function() {
    // clear output trees
    
    this._importTagsFor = 0;
    var mainLibrary = LibraryUtils.mainLibrary;
    if (this._importTagsForAlbumArtistChoice.selected) {
      this._importTagsFor = 1;
      this._items = mainLibrary.getDistinctValuesForProperty(SBProperties.albumArtistName);
    }
    /*
    else if (this._importTagsForAlbumChoice.selected) {
      this._importTagsFor = 2;
      this._items = mainLibrary.getDistinctValuesForProperty(SBProperties.albumName);
    }
    */
    else if (this._importTagsForArtistChoice.selected) {
      this._importTagsFor = 3;
      this._items = mainLibrary.getDistinctValuesForProperty(SBProperties.artistName);
    }
    else {
      return;
    }
    
    this._filterAction = 0;
    if (this._filterActionIgnoreChoice.selected) {
      this._filterAction = 1;
    }
    else if (this._filterActionOnlyChoice.selected) {
      this._filterAction = 2;
    }
    else {
      return;
    }
    
    this._tagFilterDictionary = this._getTagFilterDictionary();
    
    this._numTagsPerItem = parseInt(this._findXTagsTextbox.value);
    if (!this._numTagsPerItem || this._numTagsPerItem < 1) {
      return;
    }
    
    /*
    switch (this._importTagsFor) {
      case 1:
        this._groupByItemRadio.setAttribute("label", this._strings.getString("groupByAlbumArtist"));
        break;
      case 2:
        this._groupByItemRadio.setAttribute("label", this._strings.getString("groupByAlbum"));
        break;
      case 3:
        this._groupByItemRadio.setAttribute("label", this._strings.getString("groupByArtist"));
        break;
      default:
        return;
    }
    */

    this._disableDialog(this._strings.getString("startFindingStatusMessage"), -1);
    
    //temp
    //this._numToProcess = 10;
    
    this._tagsToImport = [];
    this._tagsToImportDict = {};
    //this._itemsToImport = [];
    //this._itemsToImportDict = {};
    this._tagToItem = {};
    this._tagToItemDict = {};
    //this._itemToTag = {};
    
    setTimeout("ImportGlobalTagsDialog.Controller.doFindTags()", 0);
  },
  
  _getTagFilterDictionary: function() {
    dict = {};
    for (var i = 0; i < this._tagFilterTreeView.dataArray.length; i++) {
      dict[this._tagFilterTreeView.dataArray[i].filteredTagName] = true;
    }
    return dict;
  },
  
  _disableDialog: function(status, progress) {
    this._updateStatus(status, progress);
    this._toggleInteraction(false);
  },

  _enableDialog: function() {
    this._updateStatus("", -1);
    this._toggleInteraction(true);
  },
  
  _toggleInteraction: function(enable) {
    this._importTagsForAlbumArtistChoice.setAttribute("disabled", !enable);
    //this._importTagsForAlbumChoice.setAttribute("disabled", !enable);
    this._importTagsForArtistChoice.setAttribute("disabled", !enable);
    this._filterActionIgnoreChoice.setAttribute("disabled", !enable);
    this._filterActionOnlyChoice.setAttribute("disabled", !enable);
    this._addTagMenu.setAttribute("disabled", !enable);
    //this._addTagTextboxLabel.setAttribute("disabled", !enable);
    //this._addTagTextbox.setAttribute("disabled", !enable);
    this._addTagChoice.setAttribute("disabled", !enable);
    this._addTopTagsChoice.setAttribute("disabled", !enable);
    this._addCommonIgnoreChoice.setAttribute("disabled", !enable);
    this._addTagButton.setAttribute("disabled", !enable);
    this._removeSelectedTagButton.setAttribute("disabled", !enable);
    this._removeAllTagsButton.setAttribute("disabled", !enable);
    //this._findXTagsTextbox.setAttribute("disabled", !enable);
    this._findTagsButton.setAttribute("disabled", !enable);
    //this._groupByItemRadio.setAttribute("disabled", !enable);
    this._tagFilterTree.setAttribute("disabled", !enable);
    this._deleteOldPlaylistsButton.setAttribute("disabled", !enable);
    //this._groupByTagRadio.setAttribute("disabled", !enable);
    this._tagResultsTagTree.setAttribute("disabled", !enable);
    this._tagResultsItemTree.setAttribute("disabled", !enable);
    this._importTagsButton.setAttribute("disabled", !enable);
  },
  
  _updateStatus: function(status, progress) {
    var progressBar = document.getElementById("progress-meter");
    progressBar.setAttribute("hidden", status.length == 0);

    if (progress < 0) {
      progressBar.setAttribute("mode", "undetermined");
    }
    else {
      progressBar.setAttribute("mode", "determined");
      progressBar.setAttribute("value", progress);
    }

    var statusText = document.getElementById("status-label");
    statusText.setAttribute("label", status);
  },
  
  doFindTags: function() {
    if (!this._items || !this._items.hasMore()
        //|| this._numToProcess <= 0 //temp
        ) {
      this._enableDialog();
      
      this._populateResultTrees();
      
      alert(this._strings.getString("doneFindingTags"));
      
      /*
      var alertText = "Tags:";
      for (var i=0; i < this._tagsToImport.length; i++) {
        alertText += this._tagsToImport[i].tagName + ", ";
      }
      alertText += "\nArtists:";
      for (var i=0; i < this._itemsToImport.length; i++) {
        alertText += this._itemsToImport[i].itemName + ", ";
      }
      
      alert(alertText);
      */
    }
    else {
      var item = this._items.getNext();
      this._updateStatus(this._strings.getFormattedString("findingTagsForItem", [item]), -1);
      
      if (this._importTagsFor == 1 || this._importTagsFor == 3) {
        this._importTagsForArtist(item, this._importTagsFor);
      }
      
      //this._numToProcess--; //temp
      
      setTimeout("ImportGlobalTagsDialog.Controller.doFindTags()", 0);
    }
  },
  
  _importTagsForArtist: function(artist, importTagsFor) {
      var requestUri = VI_LAST_FM_ROOT_URL + "?method=artist.getTopTags" + 
                          "&artist=" + encodeURIComponent(artist) +
                          "&api_key=" + VI_LAST_FM_API_KEY;

      var request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

      request.open("GET", requestUri, false);
      try {
      	request.send(null);
      }
      catch (e) {
        Cu.reportError(e);
        alert(this._strings.getString("lastfmRequestError"));
        return;
      }

      if (!request.responseXML) {
        Cu.reportError(this._strings.getString("lastfmReponseError"));
        alert(this._strings.getString("lastfmReponseError"));
        return; 
      }

      if (request.status != VI_REQUEST_SUCCESS_CODE) {
        Cu.reportError(this._strings.getString("lastfmRequestUnsuccessfulError"));
        alert(this._strings.getString("lastfmRequestUnsuccessfulError"));
        return;
      }

      var xml = request.responseXML;
      
      var tags = xml.getElementsByTagName('tag');
      var curTagNum = 0;

      for (var tagIndex = 0; tagIndex < tags.length && curTagNum < this._numTagsPerItem; tagIndex++) {      
        var tag = tags[tagIndex];
        
        var tagName = tag.getElementsByTagName('name');
        if (tagName == null || tagName.length < 1) {
          continue;
        }
        tagName = tagName[0].textContent.toLowerCase();

        var tagCount = tag.getElementsByTagName('count');
        if (tagCount == null || tagCount.length < 1) {
          continue;
        }
        tagCount = parseInt(tagCount[0].textContent);
        
        if (tagCount < 1) {
          return;
        }
        
        switch (this._filterAction) {
          case 1: // Ignore
            var useTag = true;
            if (this._tagFilterDictionary[tagName] && this._tagFilterDictionary[tagName] == true) {
              useTag = false;
            }
            break;
          case 2: // Only use
            var useTag = false;
            if (this._tagFilterDictionary[tagName] && this._tagFilterDictionary[tagName] == true) {
              useTag = true;
            }
            break;
        }
        
        if (useTag) {
          if (!this._tagsToImportDict[tagName]) {
            this._tagsToImport.push({tagName: tagName});
            this._tagsToImportDict[tagName] = true;
          }
          
          /*
          if (!this._itemsToImportDict[artist]) {
            this._itemsToImport.push({itemName: artist});
            this._itemsToImportDict[artist] = true;
          }
          */
          
          if (!this._tagToItem[tagName]) {
            this._tagToItem[tagName] = [];
            this._tagToItemDict[tagName] = {};
          }
          this._tagToItem[tagName].push(artist);
          this._tagToItemDict[tagName][artist] = true;
          
          /*
          if (!this._itemToTag[artist]) {
            this._itemToTag[artist] = [];
          }
          this._itemToTag[artist].push(tagName);
          */
          
          curTagNum++;
        }
      }
  },
  
  _createOrFindPlaylist: function(tagName, importTagsFor) {
    var playlist = null;
    
    switch (importTagsFor) {
      case 1: // album artist
        var playlistProp = ALBUM_ARTIST_TAG_PLAYLIST_PROP + tagName;
        break;
      case 2: // album
        var playlistProp = ALBUM_TAG_PLAYLIST_PROP + tagName;
        break;
      case 3: // artist
        var playlistProp = ARTIST_TAG_PLAYLIST_PROP + tagName;
        break;
    }
    
    // try to find an existing playlist
    try 
    {
  		var itemEnum = LibraryUtils.mainLibrary.getItemsByProperty(SBProperties.customType, playlistProp).enumerate();
  		if (itemEnum.hasMoreElements()) 
  		{
  			playlist = itemEnum.getNext();
  		}
  	} 
  	catch (e if e.result == Cr.NS_ERROR_NOT_AVAILABLE) 
  	{
  	  // Don't to anything - playlist will be created
  	}
    
    if (playlist == null)
    {
      playlist = LibraryUtils.mainLibrary.createMediaList("smart");
  		playlist.setProperty(SBProperties.customType, playlistProp); // Set a custom property so we know which playlist is ours
  		
  		switch (importTagsFor) {
        case 1: // album artist
          playlist.name = this._strings.getFormattedString("albumArtistTagPlaylistName", [tagName]);
          break;
        case 2: // album
          playlist.name = this._strings.getFormattedString("albumTagPlaylistName", [tagName]);
          break;
        case 3: // artist
          playlist.name = this._strings.getFormattedString("artistTagPlaylistName", [tagName]);
          break;
      }
    }  
    
    playlist.autoUpdate = true;
    playlist.matchType = Ci.sbILocalDatabaseSmartMediaList.MATCH_TYPE_ANY;
    
    return playlist;
  },
  
  _populateResultTrees: function() {
    this._tagResultsTagTreeView.clear();
    
    for (var i=0; i < this._tagsToImport.length; i++) {
      this._tagResultsTagTreeView.addTag(this._tagsToImport[i].tagName);
    }
    
    this._tagResultsTagTreeView.dataArray.sort(this.sortTagResultsTagTreeByName);
    
    this._updateTagResultsTagTree();
    this._tagResultsTagTree.view.selection.select(0);
    this._populateItemTreeFromTagSelection();
  },
  
  _updateTagResultsTagTree: function() {
    this._tagResultsTagTreeView.update();
    this._tagResultsTagTree.view = this._tagResultsTagTreeView;
  },

  _updateTagResultsItemTree: function() {
    this._tagResultsItemTreeView.update();
    this._tagResultsItemTree.view = this._tagResultsItemTreeView;
  },
  
  sortTagResultsTagList: function(column) {
    var columnName;
    var order = this._tagResultsTagTree.getAttribute("sortDirection") == "ascending" ? 1 : -1;
    //if the column is passed and it's already sorted by that column, reverse sort
    if (column) {
    	columnName = column.id;
    	if (this._tagResultsTagTree.getAttribute("sortResource") == columnName) {
    		order *= -1;
    	}
    } else {
    	columnName = this._tagResultsTagTree.getAttribute("sortResource");
    }
    
    this._tagResultsTagTree.setAttribute("sortDirection", order == 1 ? "ascending" : "descending");
    this._tagResultsTagTree.setAttribute("sortResource", columnName);
    //set the appropriate attributes to show to indicator
    var cols = this._tagResultsTagTree.getElementsByTagName("treecol");
    for (var i = 0; i < cols.length; i++) {
    	cols[i].removeAttribute("sortDirection");
    }
    document.getElementById(columnName).setAttribute("sortDirection", order == 1 ? "ascending" : "descending");
    
    // Actually sort the data    
    this.tagResultsTagTreeSortOrder = order;
    switch (columnName)
    {
      case "import-tag-name-column":
        this._tagResultsTagTreeView.dataArray.sort(this.sortTagResultsTagTreeByName);
        break;
      case "import-tag-checkbox-column":
        this._tagResultsTagTreeView.dataArray.sort(this.sortTagResultsTagTreeByImport);
        break;
    }
    
    this._updateTagResultsTagTree();
    this._populateItemTreeFromTagSelection();
  },
  
  sortTagResultsTagTreeByName: function(a, b) {
    if (a.tagName.toLowerCase() < b.tagName.toLowerCase()) return 1 * ImportGlobalTagsDialog.Controller.tagResultsTagTreeSortOrder;
    if (a.tagName.toLowerCase() > b.tagName.toLowerCase()) return -1 * ImportGlobalTagsDialog.Controller.tagResultsTagTreeSortOrder;
    return 0;
  },

  sortTagResultsTagTreeByImport: function(a, b) {
    if (a.importTag < b.importTag) return 1 * ImportGlobalTagsDialog.Controller.tagResultsTagTreeSortOrder;
    if (a.importTag > b.importTag) return -1 * ImportGlobalTagsDialog.Controller.tagResultsTagTreeSortOrder;
    return ImportGlobalTagsDialog.Controller.sortTagResultsTagTreeByName(b, a);
  },
  
  onTagTreeSelection: function(event) {
    this._populateItemTreeFromTagSelection();
  },
  
  getSelectedTag: function() {
    if (!this._tagResultsTagTree.currentIndex || this._tagResultsTagTree.currentIndex < 0) {
      var index = 0;
    }
    else {
      var index = this._tagResultsTagTree.currentIndex;
    }
    
    var selectedTag = this._tagResultsTagTreeView.dataArray[index];
    
    if (!selectedTag) return "";
    
    return selectedTag.tagName;
  },
  
  _populateItemTreeFromTagSelection: function() {
    //alert(selectedTag.tagName);
    
    this._tagResultsItemTreeView.clear();
    
    var selectedTagName = this.getSelectedTag();
    if (selectedTagName.length == 0) return;
    
    var items = this._tagToItem[selectedTagName];
    //alert(items.length);
    
    if (!items) return;
    
    for (var i=0; i < items.length; i++) {
      //alert(items[i]);
      this._tagResultsItemTreeView.addItem(items[i]);
    }
    
    this._tagResultsItemTreeView.dataArray.sort(this.sortTagResultsItemTreeByName);
    this._updateTagResultsItemTree();
  },
  
  sortTagResultsItemList: function(column) {
    var columnName;
    var order = this._tagResultsItemTree.getAttribute("sortDirection") == "ascending" ? 1 : -1;
    //if the column is passed and it's already sorted by that column, reverse sort
    if (column) {
    	columnName = column.id;
    	if (this._tagResultsItemTree.getAttribute("sortResource") == columnName) {
    		order *= -1;
    	}
    } else {
    	columnName = this._tagResultsItemTree.getAttribute("sortResource");
    }
    
    this._tagResultsItemTree.setAttribute("sortDirection", order == 1 ? "ascending" : "descending");
    this._tagResultsItemTree.setAttribute("sortResource", columnName);
    //set the appropriate attributes to show to indicator
    var cols = this._tagResultsItemTree.getElementsByTagName("treecol");
    for (var i = 0; i < cols.length; i++) {
    	cols[i].removeAttribute("sortDirection");
    }
    document.getElementById(columnName).setAttribute("sortDirection", order == 1 ? "ascending" : "descending");
    
    // Actually sort the data    
    this.tagResultsItemTreeSortOrder = order;
    switch (columnName)
    {
      case "import-item-lib-name-column":
        this._tagResultsItemTreeView.dataArray.sort(this.sortTagResultsItemTreeByName);
        break;
      case "import-item-column":
        this._tagResultsItemTreeView.dataArray.sort(this.sortTagResultsItemTreeByImport);
        break;
    }
    
    this._updateTagResultsItemTree();
  },
  
  sortTagResultsItemTreeByName: function(a, b) {
    if (a.itemName.toLowerCase() < b.itemName.toLowerCase()) return 1 * ImportGlobalTagsDialog.Controller.tagResultsItemTreeSortOrder;
    if (a.itemName.toLowerCase() > b.itemName.toLowerCase()) return -1 * ImportGlobalTagsDialog.Controller.tagResultsItemTreeSortOrder;
    return 0;
  },

  sortTagResultsItemTreeByImport: function(a, b) {
    if (a.importItem < b.importItem) return 1 * ImportGlobalTagsDialog.Controller.tagResultsItemTreeSortOrder;
    if (a.importItem > b.importItem) return -1 * ImportGlobalTagsDialog.Controller.tagResultsItemTreeSortOrder;
    return ImportGlobalTagsDialog.Controller.sortTagResultsItemTreeByName(b, a);
  },
  
  onImportTags: function() {
    this._disableDialog(this._strings.getString("startImportingStatusMessage"), -1);
    this._currentTagIndex = 0;
    setTimeout("ImportGlobalTagsDialog.Controller.doImportTags()", 0);
  },
  
  doImportTags: function() {
    if (this._currentTagIndex >= this._tagsToImport.length) {
      this._enableDialog();
      alert(this._strings.getString("doneImportingTags"));
    }
    else {
      var tagName = this._tagsToImport[this._currentTagIndex].tagName;
      if (this._tagsToImportDict[tagName]) {
        var status = this._strings.getFormattedString("importingTag", [tagName])
        this._updateStatus(status, (this._currentTagIndex + 1) / this._tagsToImport.length * 100);
        
        var playlist = this._createOrFindPlaylist(tagName, this._importTagsFor);

        switch (this._importTagsFor) {
          case 1: // album artist
            var property = SBProperties.albumArtistName;
            break;
          case 3: // artist
            var property = SBProperties.artistName;
            break;
        }

        var operator = this._propMan.getPropertyInfo(property).getOperator("=");

        if (property && operator && this._tagToItem[tagName]) {
          
          for (var i=0; i < this._tagToItem[tagName].length; i++) {
            var itemName = this._tagToItem[tagName][i];
            if (this._tagToItemDict[tagName] && this._tagToItemDict[tagName][itemName]) {
              playlist.appendCondition(property, operator, itemName, null, null);
            }
          }
          
          playlist.rebuild();
        }
      }
      
      this._currentTagIndex++;
      setTimeout("ImportGlobalTagsDialog.Controller.doImportTags()", 0);
    }
  },
}

window.addEventListener("load", function(e) { ImportGlobalTagsDialog.Controller.onLoad(e); }, false);
window.addEventListener("unload", function(e) { ImportGlobalTagsDialog.Controller.onUnLoad(e); }, false);