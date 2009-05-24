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
if (typeof LovedTracksImporterDialog == 'undefined') {
  var LovedTracksImporterDialog = {};
}

const LAST_FM_ROOT_URL = "http://ws.audioscrobbler.com/2.0/";
const LAST_FM_API_KEY = "72b14fe3e1fd7f8ff8a993b1f1e78a50";

const USER_GETLOVEDTRACKS_METHOD = "user.getLovedTracks";

const REQUEST_SUCCESS_CODE = 200

const LOVED_TRACKS_PLAYLIST_PROP = "vandelay-industries_loved-tracks-playlist";

LovedTracksImporterDialog.Controller = {
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
        
    this._treeView = {  
        dataArray: [],
        rowCount: 0,
        treeSet: false,
        getCellText : function(row,column) {  
          if (column.id == "lfm-artist-column") return this.getLfmArtist(row);
          else if (column.id == "lfm-title-column") return this.getLfmTrack(row);
          else if (column.id == "lib-artist-column") return this.getLibArtist(row);
          else if (column.id == "lib-title-column") return this.getLibTrack(row);
          else return "";  
        },  
        setTree: function(treebox) { this.treebox = treebox; this.treeSet = true; },  
        isContainer: function(row) { return false; },  
        isSeparator: function(row) { return false; },  
        isSorted: function() { return false; },  
        getLevel: function(row) { return 0; },  
        getImageSrc: function(row,col) { return null; },  
        getRowProperties: function(row,props) {},  
        getCellProperties: function(row,col,props) {
          if (col.id == "lib-artist-column") {
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
          else if (col.id == "lib-title-column") {
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
        update: function() { this.rowCount = this.dataArray.length; }, 
        getLfmArtist: function(row) { return row >= 0 && row < this.dataArray.length ? this.dataArray[row].lfmArtistName : null; },
        getLfmTrack: function(row) { return row >= 0 && row < this.dataArray.length ? this.dataArray[row].lfmTrackName : null; },
        getLibArtist: function(row) { return row >= 0 && row < this.dataArray.length ? this.dataArray[row].libArtistName : null; },
        getLibTrack: function(row) { return row >= 0 && row < this.dataArray.length ? this.dataArray[row].libTrackName : null; },
        setLibInfo: function(row, artist, track, guids) { 
          this.dataArray[row].libArtistName = artist;
          this.dataArray[row].libTrackName = track;
          this.dataArray[row].songGuids = guids; 
          if (this.treeSet) {
            this.treebox.invalidateRow(row);
          }
        },
        removeItem: function(row) { 
          if (row >= 0 && row < this.dataArray.length) {
            this.dataArray.splice(row,1);
            this.update();
            this.treebox.invalidate();
          }
        },
    };
    
    this._tree = document.getElementById("loved-tracks-tree");
    
    // Set the default username
    var usernameField = document.getElementById("last-fm-username-field");
    usernameField.value = this._defaultUsername;
    usernameField.focus();
    
    this._findLovedTracksButton = document.getElementById("go-button");
    this._findLovedTracksButton.addEventListener("command", 
          function() { controller.findLovedTracks(); }, false);
    this._removeButton = document.getElementById("remove-button");
    this._removeButton.addEventListener("command", 
          function() { controller.removeTrack(); }, false);
    this._importButton = document.getElementById("import-button");
    this._importButton.addEventListener("command", 
          function() { controller.importTracks(); }, false);
    
    this._artistField = document.getElementById("edit-artist-textbox");
    this._artistCheck = document.getElementById("edit-artist-checkbox");
    this._trackField = document.getElementById("edit-track-textbox");
    this._trackCheck = document.getElementById("edit-track-checkbox");
    
    this._selectedRow = -1;
  },

  onUnLoad: function() {
  },
  
  onEditArtistInput: function(event) {
    this._artistTextHasChanged();
  },
  
  onEditTrackInput: function(event) {
    this._trackTextHasChanged();
  },
  
  removeTrack: function(enable) {
    var selectedIndex = this._tree.currentIndex;
    if (selectedIndex >= 0) {
      this._treeView.removeItem(selectedIndex);
      this._treeView.selection.select(selectedIndex);
      
      this._updateTreeView();
      this._updateTreeAfterSelection();
    }
  },
  
  enableButtons: function(enable) {
    this._findLovedTracksButton.setAttribute("disabled", enable ? "false" : "true");
    this._importButton.setAttribute("disabled", enable ? "false" : "true");
    this._removeButton.setAttribute("disabled", enable ? "false" : "true");
  },
  
  onTreeSelection: function(event) {
    this._selectedRow = event.target.currentIndex;
    this._updateTreeAfterSelection();
  },
  
  findLovedTracks: function() {
  
    var username = document.getElementById("last-fm-username-field").value;
    var requestUri = LAST_FM_ROOT_URL + "?method=" + USER_GETLOVEDTRACKS_METHOD + 
                        "&user=" + username +
                        "&api_key=" + LAST_FM_API_KEY;

    var request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

    //alert(requestUri);
    
    request.open("GET", requestUri, false);
    try {
      this.enableButtons(false);
    	request.send(null);
      this.enableButtons(true);
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

    if (request.status != REQUEST_SUCCESS_CODE) {
      Cu.reportError(this._strings.getString("lastfmRequestUnsuccessfulError"));
      alert(this._strings.getString("lastfmRequestUnsuccessfulError"));
      return;
    }
    
    //alert(request.responseText);
    
    this._treeView.dataArray = [];
    
    var xml = request.responseXML;
    var tracks = xml.getElementsByTagName('track');
    
    for (var trackIndex = 0; trackIndex < tracks.length; trackIndex++) {      
      var artistName = this._getArtistName(tracks[trackIndex]);
      var trackName = this._getTrackName(tracks[trackIndex]);
      var songGuids = this._findSongInLibrary(artistName, trackName);
      
      var libArtistName = "";
      var libTrackName = "";
      if (songGuids != null && songGuids.length > 0) {
        libArtistName = artistName;
        libTrackName = trackName;
      }
            
      var newItem = {lfmArtistName: artistName, lfmTrackName: trackName, libArtistName: libArtistName, libTrackName: libTrackName, songGuids: songGuids};
      this._treeView.dataArray.push(newItem);
    }
    
    //todo shared code
    for (var index = 0; index < this._treeView.dataArray.length; index++) {
    
      if (this._treeView.dataArray[index].libArtistName.length == 0 && this._treeView.dataArray[index].libTrackName.length == 0) {
        var trackAtIndex = this._treeView.dataArray[index].lfmTrackName;
        var artistAtIndex = this._treeView.dataArray[index].lfmArtistName;

        var tracksMatchingName = this._findTrackInLibrary(trackAtIndex);
        var artistsMatchingName = this._findArtistInLibrary(artistAtIndex);
              
        var bestArtist = "";
        var bestArtistScore = -1000;
        
        try {
          var trackEnum = tracksMatchingName.enumerate();
          while (trackEnum.hasMoreElements()) {
            var trackItem = trackEnum.getNext();
            var artist = trackItem.getProperty(SBProperties.artistName);
            var curArtistScore = this._getDifferenceScore(artist, artistAtIndex);
            
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
            var curTrackScore = this._getDifferenceScore(track, trackAtIndex);
            
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
            var guids = this._findSongInLibrary(bestArtist, trackAtIndex);
            if (guids.length > 0) 
            {
              this._treeView.setLibInfo(index, bestArtist, trackAtIndex, guids);
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
            var guids = this._findSongInLibrary(artistAtIndex, bestTrack);
            if (guids.length > 0) 
            {
              this._treeView.setLibInfo(index, artistAtIndex, bestTrack, guids);
            }
          }
        }
      }
    }
    
    this._updateTreeView();
    
  },
  
  importTracks: function() {
    if (this._treeView.dataArray.length < 1) {
      return;
    }
    
    var playlist = null;
    
    // try to find an existing playlist
    try 
    {
  		var itemEnum = LibraryUtils.mainLibrary.getItemsByProperty(SBProperties.customType, LOVED_TRACKS_PLAYLIST_PROP).enumerate();
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
      playlist = LibraryUtils.mainLibrary.createMediaList("simple");
  		playlist.setProperty(SBProperties.customType, LOVED_TRACKS_PLAYLIST_PROP); // Set a custom property so we know which playlist is ours
      playlist.name = this._strings.getString("lovedTracksPlaylistName");
    }
    
    for (var index=0; index < this._treeView.dataArray.length; index++) {
    
      var curItem = this._treeView.dataArray[index];
      
      if (curItem.songGuids != null && curItem.songGuids.length > 0) {
        var mediaItem = LibraryUtils.mainLibrary.getItemByGuid(curItem.songGuids[0]);
        if (mediaItem != null && !playlist.contains(mediaItem)) {
          playlist.add(mediaItem);
        }
      }
    }
  },
  
  onTreeSelection: function(event) {
    this._selectedRow = event.target.currentIndex;
    this._updateTreeAfterSelection();
  },
  
  _updateTreeAfterSelection: function() {
    var libArtist = this._treeView.getLibArtist(this._selectedRow);
    this._artistField.value = libArtist != null && libArtist.length > 0 ? libArtist : this._treeView.getLfmArtist(this._selectedRow);

    var libTrack = this._treeView.getLibTrack(this._selectedRow);
    this._trackField.value = libTrack != null && libTrack.length > 0 ? libTrack : this._treeView.getLfmTrack(this._selectedRow);

    this._artistTextHasChanged();
    this._trackTextHasChanged();
  },
  
  //todo shared?
  _artistTextHasChanged: function() {
    var items = null;
    if (this._artistField.value.length > 0) {
      items = this._findArtistInLibrary(this._artistField.value);
    }
    this._artistCheck.setAttribute("checked", items != null && items.length > 0 ? "true" : "false");
    
    this._updateTrackSuggestionList(items);
    this._updateSelectedTrack();    
  },
  
  _updateTrackSuggestionList: function(artistTracks) {
    var trackList = document.getElementById("edit-track-list");
    
    while (trackList.firstChild) {
      trackList.removeChild(trackList.firstChild);
    }
    
    var foundTracks = [];
    var weightedTracks = [];
    var lfmTrackName = this._treeView.getLfmTrack(this._selectedRow);
    
    try {
    	var itemEnum = artistTracks.enumerate();
    	while (itemEnum.hasMoreElements()) {
      	var item = itemEnum.getNext();
      	var track = item.getProperty(SBProperties.trackName);
        
      	if (foundTracks[track] == null || foundTracks[track] != true) {
      	  foundTracks[track] = true;
      	  
          var curTrackScore = this._getDifferenceScore(track, lfmTrackName);
          weightedTracks.push({trackName: track, score: curTrackScore});
        }
  		}
		}
  	catch (e) {
  	}
  	
    //todo if score is shit, sort by name
  	function sortByScore(a, b) {
  	  return a.score < b.score;
  	}
  	
  	weightedTracks.sort(sortByScore);
  	
  	for (var index=0; index < weightedTracks.length; index++) {
  	  var trackItem = document.createElement("menuitem");
      trackItem.setAttribute("label", weightedTracks[index].trackName);
      trackList.appendChild(trackItem);
  	}
  },
  
  _updateSelectedTrack: function() {
    var guids = this._findSongInLibrary(this._artistField.value, this._trackField.value);
    if (guids.length > 0) {
      this._treeView.setLibInfo(this._selectedRow, this._artistField.value, this._trackField.value, guids);
    }
  },
  
  _trackTextHasChanged: function() {
    var items = null;
    if (this._trackField.value.length > 0) {
      items = this._findTrackInLibrary(this._trackField.value);
    }
    
    this._trackCheck.setAttribute("checked", items != null && items.length > 0 ? "true" : "false");
    
    var artistList = document.getElementById("edit-artist-list");
    
    while (artistList.firstChild) {
      artistList.removeChild(artistList.firstChild);
    }
    
    var foundArtists = [];
    var weightedArtists = [];
        
    var lfmArtistName = this._treeView.getLfmArtist(this._selectedRow);
    
    try {
    	var itemEnum = items.enumerate();
    	while (itemEnum.hasMoreElements()) {
      	var item = itemEnum.getNext();
      	var artist = item.getProperty(SBProperties.artistName);
      	if (foundArtists[artist] == null || foundArtists[artist] != true) {
      	  foundArtists[artist] = true;
      	
          // Give each potential artist a score
          var curArtistScore = this._getDifferenceScore(artist, lfmArtistName);
          weightedArtists.push({artistName: artist, score: curArtistScore});
      	}
      }
    }
  	catch (e) {
  	}

    function sortByScore(a, b) {
  	  return a.score < b.score;
  	}

  	weightedArtists.sort(sortByScore);

  	for (var index=0; index < weightedArtists.length; index++) {
      var artistItem = document.createElement("menuitem");
      artistItem.setAttribute("label", weightedArtists[index].artistName);
      artistList.appendChild(artistItem);
  	}
  	
    this._updateSelectedTrack();
  },
  
  //todo move these into a shared file
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
  
  // Score is above zero if it matches using some replacements, negative if it takes some corrections
  _getDifferenceScore: function(from, to) {
    
    if (from == to) {
      return 100;
    }

    from = from.toLowerCase();
    to = to.toLowerCase();
    if (from == to) {
      return 99;
    }
        
    from = this._stripWhitespace(from);
    to = this._stripWhitespace(to);
    if (from == to) {
      return 98;
    }
    
    from = this._andToAmpersand(from);
    to = this._andToAmpersand(to);
    if (from == to) {
      return 97;
    }
    
    var fromWithoutStuffInBrackets = this._stripStuffInBrackets(from);
    var toWithoutStuffInBrackets = this._stripStuffInBrackets(to);
    var fromWithoutStuffInQuotations = this._stripStuffInQuotations(from);
    var toWithoutStuffInQuotations = this._stripStuffInQuotations(to);
    
    var toIsInFrom = from.indexOf(to) >= 0;
    var fromIsInTo = to.indexOf(from) >= 0;
    
    // punctuation
    var fromOld = from;
    var toOld = to;
    from = this._stripPunctuation(from);
    to = this._stripPunctuation(to);

    var allSpecial = false;
    if (from.length == 0) {
      from = fromOld;
      allSpecial = true;
    }
    if (to.length == 0) {
      to = toOld;
      allSpecial = true;
    }
    
    if (allSpecial) {
      return 0 - this._levenshteinDistance(from, to);
    }
    
    if (from == to) {
      return 96;
    }
    
    // brackets (don't keep)
    if (this._stripPunctuation(fromWithoutStuffInBrackets) == this._stripPunctuation(toWithoutStuffInBrackets)) {
      return 95;
    }
    
    // quotations (don't keep)
    if (this._stripPunctuation(fromWithoutStuffInQuotations) == this._stripPunctuation(toWithoutStuffInQuotations)) {
      return 94;
    }
    
    // the
    from = this._stripThes(from);
    to = this._stripThes(to);
    if (from == to) {
      return 93;
    }
    
    // substrings
    if (toIsInFrom || fromIsInTo) {
      return 92;
    }
    
    return 0 - this._levenshteinDistance(from, to);
  },
  
  // all assume lower case
  _andToAmpersand: function(text) {
    var splitted = text.split("and");
    var joined = splitted.join("&");
    return joined;
  },

  _stripWhitespace: function(text) {
    // don't care about tabs or other whitespace
    return text.replace(/ /g, "");
  },

  _stripPunctuation: function(text) {
    return text.replace(/[\!\@\#\$\%\^\*\-\=\_\(\)\+\[\]\\\{\}\|\;\'\:\"\,\.\/\<\>\?\`\~]/g, "");
  },
  
  _stripStuffInBrackets: function(text) {
    text = text.replace(/\(.*\)/g, "");
    text = text.replace(/\[.*\]/g, "");
    text = text.replace(/\{.*\}/g, "");
    return text.replace(/<.*>/g, "");
  },
  
  _stripStuffInQuotations: function(text) {
    text = text.replace(/".*"/g, "");
    return text.replace(/'.*'/g, "")
  },
  
  _stripThes: function(text) {
    text = text.replace(/^the/g, "");
    text = text.replace(/the$/g, "");
    return text;
  },
  
  // From http://snippets.dzone.com/posts/show/6942
  //based on: http://en.wikibooks.org/wiki/Algorithm_implementation/Strings/Levenshtein_distance
  //and:  http://en.wikipedia.org/wiki/Damerau%E2%80%93Levenshtein_distance
  _levenshteinDistance: function(a, b)
  {
  	var i;
  	var j;
  	var cost;
  	var d = new Array();

  	if ( a.length == 0 )
  	{
  		return b.length;
  	}

  	if ( b.length == 0 )
  	{
  		return a.length;
  	}

  	for ( i = 0; i <= a.length; i++ )
  	{
  		d[ i ] = new Array();
  		d[ i ][ 0 ] = i;
  	}

  	for ( j = 0; j <= b.length; j++ )
  	{
  		d[ 0 ][ j ] = j;
  	}

  	for ( i = 1; i <= a.length; i++ )
  	{
  		for ( j = 1; j <= b.length; j++ )
  		{
  			if ( a.charAt( i - 1 ) == b.charAt( j - 1 ) )
  			{
  				cost = 0;
  			}
  			else
  			{
  				cost = 1;
  			}

  			d[ i ][ j ] = Math.min( d[ i - 1 ][ j ] + 1, d[ i ][ j - 1 ] + 1, d[ i - 1 ][ j - 1 ] + cost );

  			if(
           i > 1 && 
           j > 1 &&  
           a.charAt(i - 1) == b.charAt(j-2) && 
           a.charAt(i-2) == b.charAt(j-1)
           ){
            d[i][j] = Math.min(
              d[i][j],
              d[i - 2][j - 2] + cost
            )

  			}
  		}
  	}

  	return d[ a.length ][ b.length ];
  },
  
  //non-shared
  _updateTreeView: function() {
    this._treeView.update();
    this._tree.view = this._treeView;
  }
  
};

window.addEventListener("load", function(e) { LovedTracksImporterDialog.Controller.onLoad(e); }, false);
window.addEventListener("unload", function(e) { LovedTracksImporterDialog.Controller.onUnLoad(e); }, false);