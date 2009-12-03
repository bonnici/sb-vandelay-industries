if (typeof(Cc) == 'undefined')
	var Cc = Components.classes;
if (typeof(Ci) == 'undefined')
	var Ci = Components.interfaces;
if (typeof(Cu) == 'undefined')
	var Cu = Components.utils;
if (typeof(Cr) == 'undefined')
	var Cr = Components.results; 
	
if (typeof VandelayIndustriesShared == 'undefined') {
  var VandelayIndustriesShared = {};
}

VandelayIndustriesShared.Functions = 
{

  getArtistName: function(trackNode) {
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

  getTrackName: function(trackNode) {
    var nameElement = trackNode.getElementsByTagName('name');
    if (nameElement == null || nameElement.length < 1) {
      return "";
    }
    
    return nameElement[0].textContent;
  },
  
  getPlayCount: function(trackNode) {
    var playCountElement = trackNode.getElementsByTagName('playcount');
    if (playCountElement == null || playCountElement.length < 1) {
      return "";
    }
    
    return playCountElement[0].textContent;
  },
  
  findSongInLibrary: function(artist, track) {
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
  
  findArtistInLibrary: function(artist) {
    try {
      var mediaItems = LibraryUtils.mainLibrary.getItemsByProperty(SBProperties.artistName, artist);
		  return mediaItems;
	  } 
	  catch (e) {
	    return null;
	  }
  },
  
  findTrackInLibrary: function(track) {
    try {
      var mediaItems = LibraryUtils.mainLibrary.getItemsByProperty(SBProperties.trackName, track);
		  return mediaItems
    } 
    catch (e) {
      return null;
    }
  },
  
  // Score is above zero if it matches using some replacements, negative if it takes some corrections
  getDifferenceScore: function(from, to) {
    
    if (from == to) {
      return 100;
    }

    from = from.toLowerCase();
    to = to.toLowerCase();
    if (from == to) {
      return 99;
    }
        
    from = VandelayIndustriesShared.Functions.stripWhitespace(from);
    to = VandelayIndustriesShared.Functions.stripWhitespace(to);
    if (from == to) {
      return 98;
    }
    
    from = VandelayIndustriesShared.Functions.andToAmpersand(from);
    to = VandelayIndustriesShared.Functions.andToAmpersand(to);
    if (from == to) {
      return 97;
    }
    
    var fromWithoutStuffInBrackets = VandelayIndustriesShared.Functions.stripStuffInBrackets(from);
    var toWithoutStuffInBrackets = VandelayIndustriesShared.Functions.stripStuffInBrackets(to);
    var fromWithoutStuffInQuotations = VandelayIndustriesShared.Functions.stripStuffInQuotations(from);
    var toWithoutStuffInQuotations = VandelayIndustriesShared.Functions.stripStuffInQuotations(to);
    
    var toIsInFrom = from.indexOf(to) >= 0;
    var fromIsInTo = to.indexOf(from) >= 0;
    
    // punctuation
    var fromOld = from;
    var toOld = to;
    from = VandelayIndustriesShared.Functions.stripPunctuation(from);
    to = VandelayIndustriesShared.Functions.stripPunctuation(to);

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
      return 0 - VandelayIndustriesShared.Functions.levenshteinDistance(from, to);
    }
    
    if (from == to) {
      return 96;
    }
    
    // brackets (don't keep)
    if (VandelayIndustriesShared.Functions.stripPunctuation(fromWithoutStuffInBrackets) == VandelayIndustriesShared.Functions.stripPunctuation(toWithoutStuffInBrackets)) {
      return 95;
    }
    
    // quotations (don't keep)
    if (VandelayIndustriesShared.Functions.stripPunctuation(fromWithoutStuffInQuotations) == VandelayIndustriesShared.Functions.stripPunctuation(toWithoutStuffInQuotations)) {
      return 94;
    }
    
    // the
    from = VandelayIndustriesShared.Functions.stripThes(from);
    to = VandelayIndustriesShared.Functions.stripThes(to);
    if (from == to) {
      return 93;
    }
    
    // substrings
    if (toIsInFrom || fromIsInTo) {
      return 92;
    }
    
    return 0 - VandelayIndustriesShared.Functions.levenshteinDistance(from, to);
  },
  
  // all assume lower case
  andToAmpersand: function(text) {
    var splitted = text.split("and");
    var joined = splitted.join("&");
    return joined;
  },

  stripWhitespace: function(text) {
    // don't care about tabs or other whitespace
    return text.replace(/ /g, "");
  },

  stripPunctuation: function(text) {
    return text.replace(/[\!\@\#\$\%\^\*\-\=\_\(\)\+\[\]\\\{\}\|\;\'\:\"\,\.\/\<\>\?\`\~]/g, "");
  },
  
  stripStuffInBrackets: function(text) {
    text = text.replace(/\(.*\)/g, "");
    text = text.replace(/\[.*\]/g, "");
    text = text.replace(/\{.*\}/g, "");
    return text.replace(/<.*>/g, "");
  },
  
  stripStuffInQuotations: function(text) {
    text = text.replace(/".*"/g, "");
    return text.replace(/'.*'/g, "")
  },
  
  stripThes: function(text) {
    text = text.replace(/^the/g, "");
    text = text.replace(/the$/g, "");
    return text;
  },
  
  // From http://snippets.dzone.com/posts/show/6942
  //based on: http://en.wikibooks.org/wiki/Algorithm_implementation/Strings/Levenshtein_distance
  //and:  http://en.wikipedia.org/wiki/Damerau%E2%80%93Levenshtein_distance
  levenshteinDistance: function(a, b)
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
};
