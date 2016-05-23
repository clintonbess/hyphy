//////////////////////////////////////////////////////////////////////
//                         __               __    
// _____________  ____    |__| ____   _____/  |_  
// \____ \_  __ \/  _ \   |  |/ __ \_/ ___\   __\ 
// |  |_> >  | \(  <_> )  |  \  ___/\  \___|  |   
// |   __/|__|   \____/\__|  |\___  >\___  >__|   
// |__|               \______|    \/     \/       
//    _____  .__  __    __                        
//   /     \ |__|/  |__/  |_  ____   ____   ______
//  /  \ /  \|  \   __\   __\/ __ \ /    \ /  ___/
// /    Y    \  ||  |  |  | \  ___/|   |  \\___ \ 
// \____|__  /__||__|  |__|  \___  >___|  /____  >
//         \/                    \/     \/     \/ 
//////////////////////////////////////////////////////////////////////

var Xray = require('x-ray');
var xray = Xray();
var fs = require('fs'),
xml2js = require('xml2js');
var request = require('request');
var http = require('http');

const PORT=3333; 

// global variables to post stats in slack
var priorityLevel = 0.9;
var requestCounter = 0;
var pageCounter = 0;

// scrapeHead extracts the html data from the head of the document
// then passes it down the promise pipeline
var scrapeHead = function(sharedObject) {
	// init the sharedobject
	return new Promise(function(resolve, reject) {
		sharedObject.contents = [];
		xray(sharedObject.pageHtml,'head@html')(function(err, htmlData) {
			if (err) {
				reject(err);
			}
			else {
				sharedObject.html = htmlData;
				resolve(sharedObject);
			}
		});
	});
};
// scrapeBody extracts the html data from the body of the document
// then passes it down the promise pipeline
var scrapeBody = function(sharedObject) {
	return new Promise(function(resolve, reject) {
		xray(sharedObject.pageHtml,'body@html')(function(err, htmlData) {
			if (err) {
				reject(err);
			}
			else {
				sharedObject.html += htmlData;
				resolve(sharedObject);
			}
		});
	});
}

// helper functions

// getJavascripts finds all the javascript files in the document
// then sends it down the promise pipeline
var getJavascript = function(sharedObject) {
	return new Promise(function(resolve, reject) {
		var resultsArray = [
			{
				href: '@href',
				css: '@class',
				src: '@src'
			}
		];

		xray(sharedObject.html, 'script', resultsArray)(function(err, stuff) {
			stuff.forEach(function(element) {
				sharedObject.contents.push(element.src);
			});
			resolve(sharedObject);
		});
	});	
};
// getCSS finds all the css files in the document
// then sends it down the promise pipeline
var getCSS = function(sharedObject) {
	return new Promise(function(resolve, reject) {
		var resultsArray = [
			{
				href: '@href',
				css: '@class',
				src: '@src'
			}
		];

		xray(sharedObject.html, 'link', resultsArray)(function(err, stuff) {
			stuff.forEach(function(element) {
				// console.log(element.href);
				sharedObject.contents.push(element.href);
			});
			resolve(sharedObject);
		});
	});
};
// getImageURLs finds all the image files in the document
// then sends it down the promise pipeline
var getImageURLs = function(sharedObject) {
	return new Promise(function(resolve, reject) {
		var resultsArray = [
			{
				href: '@href',
				css: '@class',
				src: '@src'
			}
		];
		xray(sharedObject.html, 'img', resultsArray)(function(err, stuff) {
			if (err) { reject(err); }
			else {
				stuff.forEach(function(element) {
					sharedObject.contents.push(element.src);
				});
				resolve(sharedObject);
			}
		});
	});
};

var getItem = function(sharedObject) {
	return new Promise(function(resolve, reject) {
		var resultsArray = [
			{
				href: '@href',
				css: '@class',
				src: '@src'
			}
		];
		xray(sharedObject.html, 'li', resultsArray)(function(err, stuff) {
			if (err) { reject(err); }
			else {
				stuff.forEach(function(element) {
					console.log(element);
					sharedObject.contents.push(element.src);
				});
				resolve(sharedObject);
			}
		});
	});
};
// readPageAsync will requested the data from the passed
// url. After the data has been requested it will increment the global
// counting variable requestCounter
var readPageAsync = function(url) {
	return new Promise(function(resolve, reject) {
		request(url, function(error, response, body) {		
			if (!error && response.statusCode == 200) {
				console.log('Received page: ', url);
				requestCounter++;
				resolve();
				// console.log(page);
			}
			else if (response.statusCode != undefined) {
				console.log('Error opening page\n' + url + '\nStatus Code:', response.statusCode); 
				reject(error);
			}
			else {
				reject(error);
			}
		});
	});
};
// storePageData saves the html data of the requested url into 
// sharedObject variable. Later, this data is parsed by using the
// scrapeHead and scrapeBody functions
var storePageData = function(sharedObject) {
	return new Promise(function(resolve, reject) {
		request(sharedObject.url, function(error, response, body) {
			console.log(sharedObject.url);
			if (!error && response.statusCode == 200) {
				sharedObject.pageHtml = body;
				resolve(sharedObject);
			}
			else {
				reject(error);
			}
		});
	});
};
// removedUnwantedPages removes all of the images, css, and javascript
// files that are not associated with galavantier.com
var removeUnwantedPages = function(sharedObject) {
	return new Promise(function(resolve, reject) {
		sharedObject.contents = hasGalvantier(sharedObject.contents);
		resolve(sharedObject);
	});
};
// printPages prints all of the pages that have been attempted to be requested
var printPages = function(sharedObject) {
	return new Promise(function(resolve, reject) {
		var pagePromises = sharedObject.contents.map(readPageAsync);
		Promise.all(pagePromises)
		.then(function() { 
			resolve(sharedObject.url);
		})
		.catch(function(error){
			reject(error);
		});
	});	
};
// asyncMap allows an iterable asynchronous function to be
// executed sequentially
var asyncMap = function(arr, iter) {
 return new Promise(function(resolve, reject) {
   var index = 0;
   var next = function() {
     if(index < arr.length) {
    	iter(arr[index], index, function() { index++; next(); });
     } else {
       resolve();
     }
   };
   next();
 });
};
// startWarming sequences the neccessary functions
// to crawl through the pages listed in the sitemap
// var startWarming = function(url, index, callback) {
// 	var sharedObject = {
// 		url: url,
// 		html: '',
// 		contents: [],
// 		pageHtml: ''

// 	};
// 	console.log('---------------------------------');
// 	console.log('Currently Scraping:', url);
// 	console.log('---------------------------------');
// 	storePageData(sharedObject)
// 	.then(scrapeHead)
// 	.then(getJavascript)
// 	.then(getCSS)
// 	.then(scrapeBody)
// 	.then(getImageURLs)
// 	.then(removeUnwantedPages)
// 	.then(printPages)
// 	.then(function(url){
// 		console.log('---------------------------------');
// 		console.log('Finished Scraping:', url);
// 		console.log('---------------------------------');
// 		callback();
// 	})
// 	.catch(function(error){
// 		console.log('Error encountered while extracting the webpage\n', error);
// 		callback();
// 	});
// };

var startScraping = function(url) {
	var sharedObject = {
		url: url,
		html: '',
		contents: [],
		pageHtml: ''

	};
	console.log('---------------------------------');
	console.log('Currently Scraping:', url);
	console.log('---------------------------------');
	storePageData(sharedObject)
	.then(scrapeHead)
	// .then(getJavascript)
	// .then(getCSS)
	.then(scrapeBody)
	// .then(getImageURLs)
	// .then(removeUnwantedPages)
	.then(getItem)
	.then(printPages)
	.then(function(url){
		console.log('---------------------------------');
		console.log('Finished Scraping:', url);
		console.log('---------------------------------');
		callback();
	})
	.catch(function(error){
		console.log('Error encountered while extracting the webpage\n', error);
		callback();
	});
};

var warmerCallback = function() {
	// console.log('Finished processing url');
};
// hasGalvantier checks items listed in the 
// contents field of a sharedObject varaible
// contains the string "https://www.galavantier.com"
var hasGalvantier = function(urlArray) {
	var returnArray = [];
	returnArray = urlArray.filter(function(url) {
		return (url.indexOf('https://www.galavantier.com') >= 0);
	});
	return returnArray;
};
// extractWebpage gathers the data from a give url
// and passes it down the promise pipeline 
var extractWebpage = function(url) {
	return new Promise(function(resolve, reject) {
		request(url, function(error, response, body) {
			if (!error && response.statusCode == 200) {
				resolve(body);
			}
			else { reject(error); }
		});
	});
};
// writeWebpage writes the webpage data to a specified file
function writeWebpage(url, fileName){
	return new Promise(function(resolve, reject) {
	var request = require('request');
		request(url, function (error, response, body) {
	  		if (!error && response.statusCode == 200) {
	    		fs.writeFileSync(fileName, body, 'utf8');
	    		resolve();
			}
			else {
				console.log('Error: ' + err + '\n' + 'Response: ' + response);
				reject(err);
			}
		});
	});
}
// parseIndexPage retrieves the links to the index
// pages located on the sitemap index page
function parseIndexPage(fileName) {
	return new Promise(function(resolve, reject) {
		var indexPages = [];
		var parseString = require('xml2js').parseString;
		var fileData = fs.readFileSync(fileName, 'utf8'); 
		var xml = fileData;
		parseString(xml, function (err, result) {
		    var sitesArray = result.sitemapindex.sitemap;
		    sitesArray.forEach (function (site){
				indexPages.push(site.loc[0]);
		    });
		    resolve(indexPages);
		});
	});
}
// parsesites locates all of the sites from 
// the index pages and stores the url and priority
// into a sitesObj variable
function parseSites (fileName, sitesObj){
	var filePath = fileName;
	var parseString = require('xml2js').parseString;
	var indexPages = [];
	var fileData = fs.readFileSync(filePath, 'utf8'); 
	var xml = fileData;
	parseString(xml, function (err, result) {
		var test = result.urlset.url;
	    test.forEach (function (site){
	    	var tempObj = 	{
				url: site.loc[0],
				priority: (typeof site.priority !== "undefined") ? site.priority[0] : 0.5
			};
			sitesObj.push(tempObj);
		});
	});
}
// handleRequest parses ther requested url to form
// a proper api call
function handleRequest(request, response){
	try {
		console.log(request.url);
		var regex = /([\?\=])/;
		var temp = request.url.split(regex);
		priorityLevel = temp[4];

		if(temp[0] != '/favicon.ico') {
			if(temp[0] == '/start' && temp[1] == '?' && temp[2] == 'priority' && temp[3] == '=') {
				request.url = temp[0];
				console.log(temp);
			} 
			else {
				request.url = '/errURL';
			}
		}
		dispatcher.dispatch(request, response);
	} catch(err) {
		console.log(err);
	}
    response.end('It Works!! Path Hit: ' + request.url);
}
// sendToSlack is used to send messages to slack that pertain
// to the cacheWarmers progress
function sendToSlack(message) {
	var token = 'xoxp-3170001118-3189767189-4014463479-fbf1d8';
	var https = require('https');

	var options = {
	  host: 'slack.com',
	  path: "/api/chat.postMessage?token=" + token + "&channel=C0558B9S9&text=" + encodeURIComponent(message) + "&username=slackbot&pretyt=1"
	};
	var slackCallback = function(response) {
	  var responseFromSlack = ""
	  response.on('data', function (chunk) {
	    responseFromSlack += chunk;
	  });
	  response.on('end', function () {
	    responseFromSlack = JSON.parse(responseFromSlack);
	    if (responseFromSlack.hasOwnProperty("ok") && responseFromSlack.ok === true) {
	      console.log("Message successfully Slacked! The below message was delivered with timestamp " + responseFromSlack.ts);
	      console.log(message);
	    }
	    else {
	      console.error("Received an unexpected response from slack while trying to post message " + message);
	    }
	  });
	}
	var req = https.request(options, slackCallback);
	req.on('error', function(e) {
	  console.error('Attempting to send the message to Slack failed with error: ' + e.message);
	});
	req.end()
}
// slackReporter sends the total number of pages requested and
// the priority threshold used to run the cache warmer
function slackReporter() {
	sendToSlack('The cache warmer has finished processing.\nTotal number of items received: ' + requestCounter 
		+ '\nTotal number of webpages crawled: ' + pageCounter + '\nPriority Level: ' + priorityLevel);
}
// writeMainIndex writes the main index page to a file
function writeMainIndex(pageBody) {
		// write the index to a file so we can parse it later
		var filePath = __dirname + '/mainIndex.xml';
		fs.writeFileSync(filePath, pageBody, 'utf8');
		var pages = parseIndexPage(filePath);
		return pages;
}
// writeSubIndexes writes the sub pages of the main index to a file
function writeSubIndexes(pagesToWrite) {
	return new Promise(function(resolve, reject) {
		var indexPageFileNames = [];
		var writePromises = [];
		pagesToWrite.forEach(function(page, index) {
			var fileToWrite = 'indexPage' + (index+1) + '.xml';
			indexPageFileNames.push(fileToWrite);
			writePromises.push(writeWebpage(page, fileToWrite));
		});
		Promise.all(writePromises).then(function() {
			resolve(indexPageFileNames);
		});
	});
}
// crawlPages first parses all of the sites located on the subindex 
// pages and stores the data into a sitesObj variable.  Afterwards it 
// applies the startWarming sequence on each of the sitesObj generated
function crawlPages(fileNames) {
	return new Promise(function(resolve, reject) {
		var sitesObj = [];
		fileNames.forEach(function(file) {
			parseSites(file, sitesObj);
		});
		var urlArray = [];
		var lowPriority = 0;
		sitesObj.forEach(function(obj, index){
			if(obj.priority >= priorityLevel){
				pageCounter++;
				// debugging
				// if(obj.url == "https://www.galavantier.com/las-vegas/nightclubs/xs-nightclub/events/kaskade-8-26-2016")
					urlArray.push(obj.url);
			}
			else if(obj.priority <= 0.2) {
				lowPriority++;
			}
		});
		asyncMap(urlArray, startWarming).then(function() { resolve(); });
	});
}

// Main
// ------------------------------------------------------------
//Create a server

var testurl = 'http://www.amazon.com/s/ref=sr_nr_n_23?fst=as%3Aoff&rh=n%3A3420550011%2Ck%3Anike&keywords=nike&ie=UTF8&qid=1463622714&rnid=2941120011';

// startScraping(testurl);

xray(testurl, 'li.s-result-item', [{
	title: 'h2',
	price: 'span.a-size-base',
	rating: 'a.a-icon-alt'
}]
)
(function(err, results){
	results.forEach(function(item, index){
		console.log(index, item);
	})
});