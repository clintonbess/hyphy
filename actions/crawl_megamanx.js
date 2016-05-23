// Crawls www.draislv.com/calendar/ and scrapes the prices
// associated with future events
var Xray = require('x-ray');
var xray = Xray();
var Horseman = require('node-horseman');
var fs = require('fs')
	, request = require('request');

var urlToScrape = 'http://www.ebay.com/sch/i.html?_sacat=0&_nkw=secret+of+mana+2&_frs=1';
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
				resolve(sharedObject);
			}
		});
	});
}
// storePageData saves the html data of the requested url into 
// sharedObject variable. Later, this data is parsed by using the
// scrapeHead and scrapeBody functions
var storePageData = function(sharedObject) {
	return new Promise(function(resolve, reject) {
		request(sharedObject.url, function(error, response, body) {
			// console.log(sharedObject.url);
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
var getItem = function(sharedObject) {
	return new Promise(function(resolve, reject) {
		var resultsOptions = [
			{
				price: 'span.bold'	,
				title: 'a.vip'
			}
		];
		xray(sharedObject.html, 'li.sresult', resultsOptions)(function(err, results) {
			if (err) { reject(err); }
			else {
				results.forEach(function(element) {
					console.log(element);
					sharedObject.contents.push(element.title);
				});
				// console.log('before cleanup\n', sharedObject.contents);
				// removeUnwantedPages(sharedObject.contents);
				// console.log('contents:\n', sharedObject.contents);
				resolve(sharedObject);
			}
		});
	});
};
var asyncMap = function(arr, iter) {
	console.log('inside it');
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
var removeUnwantedPages = function(sharedObject) {
	return new Promise(function(resolve, reject) {
		sharedObject.contents = hasDrais(sharedObject.contents);
		resolve(sharedObject);
	});
};
var hasDrais = function(urlArray) {
	var returnArray = [];
	returnArray = urlArray.filter(function(url) {
		return ( (url.indexOf('http://www.draisbeachclub.com') >= 0 ) 
			  || (url.indexOf('http://www.draisnightlife.com') >= 0 ) 
			  || (url.indexOf('http://www.draisafterhourslv.com') >= 0 ) );
	});
	return returnArray;
};
var printStats = function(sharedObject) {
	sharedObject.contents.forEach(function(item, index) {
		console.log(index, item);
	});
};
var loadPhantomInstance = function (sharedObject) {
	return new Promise(function (resolve, reject) {
		var PATH_TO_PHANTOM = '/usr/local/bin/phantomjs';
		var options = {
			phantomPath: PATH_TO_PHANTOM,
			loadImages: true,
			injectJquery: true,
			webSecurity: false,
			ignoreSSLErrors: true,
			injectBluebird: true,
			bluebirdDebug: true,
			timeout: 20000,
			interval: 20
		};

		var phantomInstance = new Horseman(options);

		phantomInstance.on('consoleMessage', function(msg) {
			console.log('Phantom page log: ', msg);
		});

		phantomInstance.on('error', function(msg) {
			console.log('Phantom page error: ', msg);
		});
		
		sharedObject.phantom = phantomInstance;
		resolve(sharedObject);
	});
};
// starts scraping the url for information
var scrapeItem = function(searchObj, index, callback) {
	var screenshotPath = searchObj.searchTitle.replace(/ /g, '_') + '.png';
	screenshotPath = './screenshots/' + screenshotPath;
	var sharedObject = {
		phantom: searchObj.phantom,
		currentURL: '',
		contents: [],
		pageHtml: '',
		timeVariable: '', // TODO:finish later
		pagesScraped: 0,
		searchTitle: searchObj.searchTitle,
		searchType: searchObj.searchType,
		screenshotPath: screenshotPath
	};
	

	console.log('---------------------------------');
	console.log('Currently Scraping:', searchObj.searchTitle);
	console.log('---------------------------------');

	// console.log(sharedObject.screenshotPath);

	
	// .then(setItemView)
	// .then(setOptions)
	// .then(getData)
	loadPhantomInstance(sharedObject)
	.then(searchForTitle)
	.then(implementOptions)
	.then(openFirstPage)
	.then(openNextPage)
	// .then(checkForMorePages)
	.then(function(){
		sharedObject.phantom.close();
		console.log('---------------------------------');
		console.log('Finished Scraping:', searchObj.searchTitle);
		console.log('---------------------------------');
		callback();
	})
	.catch(function (error){
		sharedObject.phantom.close();
		console.log('Error encountered while scraping the title: %s\n', searchObj.searchTitle, error);
		callback();
	});
};

var initializePhantom = function(searchObj) {
	return new Promise(function (resolve, reject) {
		var ebayURL = 'http://www.ebay.com/';
		searchObj.phantom
			.userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0')
			.on('urlChanged', function (newURL) {
				console.log(newURL);
			})
			.open(ebayURL) // maybe we can search from any ebay page
			.then(function () {
				resolve(searchObj);
			})
			.catch(function (error) {
				console.log('Error encountered inside \'initializePhantom\'');
				reject(error);
			});
	});
};

var searchForTitle = function(sharedObject) {
	// console.log('test1:', typeof sharedObject.phantom);
	var ebayURL = 'http://www.ebay.com/';
	return new Promise(function (resolve, reject) {
		sharedObject.phantom
			.userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0')
			.on('urlChanged', function (newURL) {
				sharedObject.currentURL = newURL;
			})
			.open(ebayURL) // maybe we can search from any ebay page
			.type('input[name="_nkw"]', sharedObject.searchTitle)
			.keyboardEvent('keypress',16777221)
			.waitForNextPage()
			.screenshot(sharedObject.screenshotPath)
			.evaluate(function() {
				var selector = document.querySelector('#gh-ac.gh-tb');
				selector.value = '';
			})
			.then(function () {
				// setTimeout(function() {resolve(sharedObject) }, 2000);
				// console.log('here?')
				resolve(sharedObject);
			})
			.catch(function (error) {
				console.log('Error encountered inside \'searchForTitle\'');
				reject(error);
			});
	});
};

var implementOptions = function(sharedObject) {
	var nextURL = '';
	return new Promise(function (resolve, reject) {
		sharedObject.phantom
			.evaluate(function () {
				a = document.querySelectorAll('span.cbx');
				for(var i = 0; i < a.length; i++) {
					if (a[i].innerHTML == 'Completed listings') {
						nextURLNode = a[i].parentNode.parentNode.getAttribute('href');
						// nextURL = 'a[href=\"' + nextURL + '\"]'; 
						// nextURL = a[i].parentNode.parentNode;
						// nextURL.click();
						// console.log('heres our new url: ', nextURL);
						return nextURLNode;
						// break;
					}
				}
			})
			// .waitForNextPage()
			.then(function (please) {
				sharedObject.currentURL = please;
				
			})
			// .click('img[src="http://thumbs.ebaystatic.com/images/g/JBMAAOSw71BXQUBh/s-l225.jpg"]')
			// .open(nextURL)

			.screenshot(sharedObject.screenshotPath)
			.close()
			.then(function () {
				// setTimeout(function() {resolve(sharedObject) }, 2000);
				resolve(sharedObject);
			})
			.catch(function (error) {
				console.log('Error encountered inside \'implementOptions\'');
				reject(error);
			});
	});
};

var openFirstPage = function(sharedObject) {
	loadPhantomInstance(sharedObject);
	return new Promise(function (resolve, reject) {
		sharedObject.phantom
			.userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0')
			.on('urlChanged', function (newURL) {
				console.log(newURL);
			})
			// .on('loadStarted', function () {
			// 	setTimeout(function() {
			// 		console.log("FUCKING starting");}, 2000);
			// })
			// .on('loadFinished', function () {
			// 	setTimeout(function() {
			// 		console.log("FUCKING Finished");}, 200);
			// })
			.open(sharedObject.currentURL) // maybe we can search from any ebay page
			// .waitForNextPage()
			// .screenshot(sharedObject.screenshotPath)
			// .evaluate(function() {
				// var selector = document.querySelector('a.gspr.next');
				// selector.click('href');
				// return selector;
			// })
			// .then(function(selector) {
			// 	console.log('Here is our selector: ', selector);
			// })
			// .waitForNextPage()
			.then(function () {
				// setTimeout(function() {resolve(sharedObject) }, 2000);
				resolve(sharedObject);
			})
			.catch(function (error) {
				console.log('Error encountered inside \'openNewPage\'');
				reject(error);
			});
	});
};
var openNextPage = function(sharedObject) {
	return new Promise(function (resolve, reject) {
		var repeat = 0;
		console.log('getting data...');
		sharedObject.phantom
			.evaluate(function() {
				var selector = document.querySelector('a.gspr.next');
				if(selector != null){
					setTimeout(function () {
						selector.click('href');
					}, 20);
				}
				return(selector != null);
			})
			.then(function(selector) {
				repeat = selector;
			})
			.then(function () {
				if(repeat && (sharedObject.pagesScraped < 20)) {
					sharedObject.pagesScraped++;
					sharedObject.phantom.waitForNextPage()
					.then(function () {
						openNextPage(sharedObject)
						.then(function () {
							resolve(sharedObject);	
						})
						.catch(function (error) {
							console.log('Error encountered inside \'openNextPage recurs1\' ' + error );
							// if(error == 'Error: Failed to load url') {
							// 	loadPhantomInstance(sharedObject)
							// 	.then(openNextPage)
							// 	.then(function() {
							// 		resolve(sharedObject);	
							// 	});
							// }
								
							// else
								reject(error);
						});
					})
					.catch(function (error) {
						console.log('Error encountered inside \'openNextPage recurs2\' ' + error);
						reject(error);
					});
				}
				else
					resolve(sharedObject);
			})
			.catch(function (error) {

				console.log('Error encountered inside \'openNextPage\'');
				reject(error);
			});
	});
};

var checkForMorePages = function(sharedObject) {
	loadPhantomInstance(sharedObject);
	return new Promise(function (resolve, reject) {
		sharedObject.phantom
			.userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0')
			.on('urlChanged', function (newURL) {
				console.log(newURL);
			})
			.open(sharedObject.currentURL) // maybe we can search from any ebay page
			.type('input[name="_nkw"]', sharedObject.searchTitle)
			.keyboardEvent('keypress',16777221)
			.waitForNextPage()
			.screenshot(sharedObject.screenshotPath)
			.evaluate(function() {
				var selector = document.querySelector('#gh-ac.gh-tb');
				selector.value = '';
			})

			.then(function () {
				// setTimeout(function() {resolve(sharedObject) }, 2000);
				resolve(sharedObject);
			})
			.catch(function (error) {
				console.log('Error encountered inside \'openNewPage\'');
				reject(error);
			});
	});
};

var searchForItem = function(phantomInstance, url, itemName) {


	phantomInstance
		.userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0')
		.on('urlChanged', function (newURL) {
			console.log(newURL);
		})
		.open(url)
		.type('input[]', itemName)
		// .screenshot('./screenshots/megamanx1.png')
		.keyboardEvent('keypress',16777221)
		.waitForNextPage()
		.screenshot('./screenshots/megamanx2.png')
		.evaluate(function () {
			var a = document.querySelectorAll('span.cbx');
			for(var i = 0; i < a.length; i++) {
				if (a[i].innerHTML == 'Completed listings') {
					var returnVar = a[i].parentNode.parentNode.getAttribute('href');
				}
			}
			return returnVar;
		})
		.then(function(completedPage) {
			console.log('here is the link to the new page', completedPage);
		})
		// .click('input[href="http://www.draislv.com/calendar/"]')
		// .count(':checkbox > :contains(Completed listings)')
		// .log()
		.close()
		.catch(function(error){
			console.log('Error encountered while searching for the item\n', error);
		// callback();
		});
		// for(var i = 0; i < a.length; i++) { if (a[i].innerHTML == "Completed listings") console.log(a[i].parentNode.parentNode.getAttribute('href')); }
};

var beginScraping = function(searchObj) {
	return new Promise(function (resolve, reject) {
		var searchObjArray = [];
		searchObj.searchItems.forEach(function (searchItem) {
			var tempObj =  {
				searchTitle: searchItem,
				searchType: searchObj.searchType,
				phantom: searchObj.phantom
			};
			searchObjArray.push(tempObj);
		});
		asyncMap(searchObjArray, scrapeItem)
		.then(function() {
			resolve('beginScraping has finished!');
		});
	});
};

module.exports = function(phantomInstance, searchType) {

	// start at ebay.com 
	// search for mega man x
	// get prices and titles
	// find remanining pages to scrape
	// repeat

	// // TODO check searchType as string type
	
	var search = ['mega man x super nintendo', 'super mario world super nintendo'] ;

	var searchObj = {
		searchItems: search,
		searchType: searchType || 'completed',
		phantom: phantomInstance
	};

	// searchObj.searchItems.push(search);
	// initializePhantom(searchObj)
	beginScraping(searchObj)
	.then(function (message) {
		console.log(message);
		phantomInstance
		.close();
	});



	// phantomInstance
	// .userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0')
	// // .on('urlChanged', function(newURL) {
	// // 	console.log(newURL);
	// // })
	// .open(urlToScrape)
	// // .status()
	// // .then(function(statusCode) {
	// // 	if (Number(statusCode >= 400)) {
	// // 		throw 'Page failed with status:' + statusCode;
	// // 	} 
	// // })

	// // // .type('input[name="field-keywords"]', 'whatsapp')
	// // // .click('a[href="http://www.draislv.com/calendar/"]')
	// // // .keyboardEvent('keypress',16777221)
	// // // .waitForNextPage()
	// // // .waitForSelector('li.s-result-item')
	// // // .count('.uvc-date .uvc-s .uvc-multiple')
	// // // .log()
	// // .screenshot('./screenshots/megamanx.png')


	// // // .evaluate(function () {
 // // 	//  	$ = window.$ || window.jQuery;
	// //  //  	var fullHtml = $('body').html();
 // // 	//  	console.log(fullHtml);
	// // // })
	// // .catch(function (err) {
	// // 		console.log('Error: ', err);
	// // 	})
	// .close();
	
};