/*!
 * Aloha Editor
 * Author & Copyright (c) 2010 Gentics Software GmbH
 * aloha-sales@gentics.com
 * Licensed unter the terms of http://www.aloha-editor.com/license.html
 */

(function (window, undefined) {
	
	'use strict'
	
	var GENTICS = window.GENTICS || (window.GENTICS = {}),
		 jQuery = window.alohaQuery || window.jQuery,
		  Aloha = window.Aloha;
	
	var sid = '';
	
	function getSid (callback) {
		jQuery.ajax({
			url: '/Aloha-Editor/Aloha-Editor-Browser/src/demo/browser/gcn_proxy.php?url='
				 + encodeURIComponent('http://cms.soc-aacc.office/.Node/?do=31&login=node&password=node'),
			error: function (data) {},
			success: function (data) {
				var json = JSON.parse(data);
				
				sid = json.sessionToken;
				
				if (sid && sid != '' && typeof callback === 'function') {
					callback();
				}
			}
		});
	};
	
	function createRepository () {
		/**
		 * Create the Repositories object. Namespace for Repositories
		 * @hide
		 */
		if (!Aloha.Repositories) {
			Aloha.Repositories = {};
		}
		
	};
	
	function initializeRepository () {
		
		var host = 'http://cms.soc-aacc.office';
		
		function restURL (method) {
			var delim = method.match(/\?[^\=]+\=/) ? '&' : '?';
			var url = host + '/CNPortletapp/rest/' + method + delim + 'sid=' + sid;
			
			return '/Aloha-Editor/Aloha-Editor-Browser/src/demo/browser/gcn_proxy.php?url='
				+ encodeURIComponent(url);
		};
		
		/**
		 * register the plugin with unique name
		 */
		var Repo = Aloha.Repositories.GCNRepo = new Aloha.Repository('com.gentics.aloha.GCN.Document');
		
		Repo.init = function () {
			this.repositoryName = 'com.gentics.aloha.GCN.Document';
		};
		
		/**
		 * Convert orderBy from [{field: order} ...] to [{by:field, order:order} ...]
		 * for easier access in sort comparison function
		 */
		Repo.buildSortPairs = function (orderBy) {
			if (orderBy == null) {
				return [];
			}
			
			var i = orderBy.length,
				sort,
				field,
				order,
				newOrder = [];
			
			while (i--) {
				sort = orderBy[i];
				for (field in sort) {
					order = sort[field];
					if (typeof order === 'string') {
						order = order.toLowerCase();
						if (order == 'asc' || order == 'desc') {
							newOrder[i] = {by: field, order: order};
							break;
						}
					}
				}
			}
			
			return newOrder;
		};
		
		/**
		 * Prepares filters patterns according to:
		 *		http://docs.oasis-open.org/cmis/CMIS/v1.0/cd04/cmis-spec-v1.0.html#_Ref237323310
		 * Examples:
		 *		*				(include all Renditions)
		 *		cmis:thumbnail	(include only Thumbnails)
		 *		Image/*			(include all image Renditions)
		 *		application/pdf, application/x-shockwave-flash
		 *						(include web ready Renditions)
		 *		cmis:none		(exclude all Renditions)
		 */
		Repo.buildRenditionFilterChecks = function (filters) {
			var f,
			    pattern,
				type,
				subtype,
			    checks = [],
				i = filters.length;
			
			while (i--) {
				f = filters[i];
				
				if (f == '*') {
					// all renditions
					return ['*'];
				} else if (f.substring(0, 5) == 'cmis:') {
					pattern = f.substring(5, f.length);	
					
					// no renditions
					if (pattern == 'none') {
						return [];
					}
					
					// check against kind
					checks.push(['kind', pattern]);
				} else if (f.match(/([a-z0-9]+)\/([a-z0-9\*]+)/i)) {
					type = RegExp. $1;
					subtype = RegExp.$2;
					
					// check against mimeType
					checks.push([
						'mimeType',
						subtype == '*'
							? new RegExp(type + '\/.*', 'i')
							: f.toLowerCase()
					]);
				}
			}
			
			return checks;
		};
		
		/**
		 * Transform the given data (fetched from the backend) into a repository folder
		 * @param {Object} data data of a folder fetched from the backend
		 * @return {GENTICS.Aloha.Repository.Object} repository item
		 */
		Repo.getFolder = function(data) {
			if (!data) {
				return null;
			}
			
			return new Aloha.Repository.Folder({
				repositoryId: this.repositoryId,
				type: 'folder',
				id: data.id,
				name: data.name
			});
		};

		/**
		 * Transform the given data (fetched from the backend) into a repository item
		 * @param {Object} data data of a page fetched from the backend
		 * @return {GENTICS.Aloha.Repository.Object} repository item
		 */
		Repo.getDocument = function(data, objecttype) {
			if (!data) {
				return null;
			}
			
			objecttype = objecttype || 10007;
			// set the id
			data.id = objecttype + '.' + data.id;
			
			// make the path information shorter by replacing path parts in the middle with ...
			var path = data.path;
			var pathLimit = 55;
			
			if (path && (path.length > pathLimit)) {
				path = path.substr(0, pathLimit/2) + '...' + path.substr(path.length - pathLimit/2);
			}
			
			data.path = path;
			
			// TODO make this more efficient (don't make a single call for every url)
			if (data.url && GENTICS.Aloha.GCN.settings.renderBlockContentURL) {
				data.url = GENTICS.Aloha.GCN.renderBlockContent(data.url);
			}
			
			data.repositoryId = this.repositoryId;
			
			return new Aloha.Repository.Document(data);
		};
		
		Repo.getPages = function (id, params, collection, callback) {
			var that = this;
			
			jQuery.ajax({
				url		 : restURL('folder/getPages/' + id),
				params	 : params,
				dataType : 'json',
				type	 : 'GET',
				error	 : function (data) {
					that.handleRestResponse(data);
					callback(collection);
				},
				success	: function (data) {
					if (that.handleRestResponse(data)) {
						if (typeof collection !== 'object') {
							collection = [];
						}
						
						for (var i = 0; i < data.pages.length; i++) {
							data.pages[i] = that.getDocument(data.pages[i], '10007');
							collection.push(data.pages[i]);
						}
					}
					
					callback(collection);
				}
			});
		};
		
		Repo.getFiles = function (id, params, collection, callback) {
			var that = this;
			
			jQuery.ajax({
				url		 : restURL('folder/getFiles/' + id),
				params	 : params,
				dataType : 'json',
				type	 : 'GET',
				error	 : function (data) {
					that.handleRestResponse(data);
					callback(collection);
				},
				success	: function (data) {
					if (that.handleRestResponse(data)) {
						if (typeof collection !== 'object') {
							collection = [];
						}
						
						for (var i = 0; i < data.files.length; ++i) {
							data.files[i] = that.getDocument(data.files[i], '10008');
							collection.push(data.files[i]);
						}
					}
					
					callback(collection);
				}
			});
		};
		
		Repo.getImages = function (id, params, collection, callback) {
			var that = this;
			
			jQuery.ajax({
				url		 : restURL('folder/getImages/' + id),
				params	 : params,
				dataType : 'json',
				type	 : 'GET',
				error	 : function (data) {
					that.handleRestResponse(data);
					callback(collection);
				},
				success	: function (data) {
					if (that.handleRestResponse(data)) {
						if (typeof collection !== 'object') {
							collection = [];
						}
						
						for (var i = 0; i < data.images.length; ++i) {
							data.images[i] = that.getDocument(data.images[i], '10009'); // TODO confirm 10009
							collection.push(data.images[i]);
						}
					}
					
					callback(collection);
				}
			});
		};
		
		/**
		 * Searches a repository for object items matching query if objectTypeFilter.
		 * If none found it returns null.
		 *
		 * TODO: implement cache
		 */
		Repo.query = function (p, callback) {
			var that = this;
			
			if (!sid || sid == '') {
				var args = arguments;
				
				getSid(function () {
					that.query.apply(that, args);
				});
			} else {
				// check whether a magiclinkconstruct exists. If not, just do nothing, since setting GCN links is not supported
				//if (!GENTICS.Aloha.GCN.settings.magiclinkconstruct) {
				//	callback.call(that);
				//}
				
				var params = {
				//	links: GENTICS.Aloha.GCN.settings.links
				};
				
				if (p.queryString) {
					params.query = p.queryString;
				}
				
				if (p.maxItems) {
					params.maxItems = p.maxItems;
				}
				
				if (p.skipCount) {
					params.skipCount = p.skipCount;
				}
				
				if (p.inFolderId) {
					params.folderId = p.inFolderId;
					params.recursive = false;
				}
					
				var fetchPages = true,
					fetchFiles = true,
					fetchImages = true;
				
				if (p.objectTypeFilter && p.objectTypeFilter.length) {
					if(jQuery.inArray('website', p.objectTypeFilter) == -1) {
						fetchPages = false;
					}
					
					if(jQuery.inArray('files', p.objectTypeFilter) == -1) {
						fetchFiles = false;
					}
					
					if(jQuery.inArray('images', p.objectTypeFilter) == -1) {
						fetchImages = false;
					}
				}
				
				var processResults = function (data) {
					that.processQueryResults(data, params, callback);
				};
				
				// TODO: We need another way to chain these
				// what if the combo is fetchPages and fetchImages or fetchFiles and fetchIMages?
				
				if (fetchPages && fetchFiles && fetchImages) {
					var collection = [];
					
					this.getPages(
						p.inFolderId,
						params,
						collection,
						function (collection) {
							that.getFiles(
								p.inFolderId,
								params,
								collection,
								function (collection) {
									that.getImages(
										p.inFolderId,
										params,
										collection,
										processResults
									);
								}
							);
						}
					);
				} else if (fetchPages && fetchFiles) {
					var collection = [];
					this.getPages(
						p.inFolderId,
						params,
						collection,
						function (collection) {
							that.getFiles(
								p.inFolderId,
								params,
								collection,
								processResults
							);
						}
					);
				} else if (fetchPages) {
					this.getPages(
						p.inFolderId,
						params,
						[],
						processResults
					);
				} else if (fetchFiles) {
					this.getPages(
						p.inFolderId,
						params,
						[],
						processResults
					);
				} else if (fetchImages) {
					this.getImages(
						p.inFolderId,
						params,
						[],
						processResults
					);
				}
			}
		};
		
		/**
		 * Handles queryString, filter, and renditionFilter which the REST-API
		 * doesn't at the moment
		 */
		Repo.processQueryResults = function (data, params, callback) {
			var skipCount = 0,
				l = data.length,
				i = 0,
				num = 0,
				results = [],
				rgxp = new RegExp(params.queryString || '', 'i'),
				elem,
				obj;
			
			var hasQueryString = !!params.queryString,
			    hasFilter = !!params.filter,
			    hasRenditionFilter = false;
			
			if (params.renditionFilter && typeof params.renditionFilter === 'object') {
				hasRenditionFilter = params.renditionFilter.length > 0;
			}
			
			var contentSets = {};
			
			for (; i < l; i++) {
				elem = data[i];
				
				if ( !hasQueryString || elem.name.match(rgxp) || elem.url.match(rgxp) ) {
					if (skipCount) {
						skipCount--;
					} else {
						if (hasFilter) {
							// Copy all required fields
							obj = {
								id		 : elem.id,
								name	 : elem.name,
								baseType : 'document',	// TODO: could we use contentGroupId?
								type	 : 'page'
							};
							
							// Copy all requested fields
							for (var f = 0; f < params.filter.length; f++) {
								obj[params.filter[f]] = elem[params.filter[f]];
							}
						} else {
							obj = elem;
						}
						
						if (!contentSets[elem.contentSetId]) {
							contentSets[elem.contentSetId] = [];
							results[num++] = obj;
						}
						
						contentSets[elem.contentSetId].push(elem);
					}
				}
			};
			
			// Build renditions from contentSet hash table
			var renditions = {};
			jQuery.each(contentSets, function () {
				var members = [],
					i = 1,
					j = this.length,
					r;
				
				for (; i < j; i++) {
					var r = this[i];
					members.push({
						id		: r.id,	
						url		: r.path + r.fileName,
						filename: r.fileName,
						kind	: 'translation',
						language: r.language,
						mimeType: 'text/html',
						height	: null,
						width	: null
					});
				}
				
				renditions[this[0].id] = members;
			});
			
			var orderBy = this.buildSortPairs(params.orderBy);
			
			if (orderBy.length > 9999) {
				// Algorithm to sort entries based on order of each columns
				// importance as defined by order of sortorder-sortby pairs
				results.sort(function (a, b) {
					var i = 0,
						j = orderBy.length,
						sort;
					
					for (; i < j; i++) {
						sort = orderBy[i];
						
						if (a[sort.by] == b[sort.by]) {
							if (i == j - 1) {
								return 0;
							}
						} else {
							return (
								((sort.order == 'asc') ? 1 : -1)
									*
								((a[sort.by] < b[sort.by]) ? -1 : 1)
							);
						}
					}
				});
			}
			
			results = results.slice(0, params.maxItems || l);
			
			if (hasRenditionFilter && (i = results.length) && renditions) {
				var renditionChecks = this.buildRenditionFilterChecks(params.renditionFilter),
					r;
				
				while (i--) {
					if (r = renditions[results[i].id]) {
						results[i].renditions =
							this.getRenditions(r, renditionChecks);
					} else {
						results[i].renditions = [];
					}
				}
			}
			
			callback.call(this, results);
		};
		
		Repo.getRenditions = function (renditions, renditionChecks) {
			var matches = [],
			    alreadyMatched = [],
			    check,
				matched = false;
			
			for (var j = renditions.length - 1; j >= 0; j--) {
				for (var k = renditionChecks.length - 1; k >= 0; k--) {
					check = renditionChecks[k];
					
					if (check == '*') {
						matched = true;
					} else if (typeof check[1] === 'string') {
						matched = renditions[j][check[0]].toLowerCase() == check[1];
					} else {
						matched = renditions[j][check[0]].match(check[1]);
					}
					
					matched
						&& jQuery.inArray(j, alreadyMatched) == -1
							&& matches.push(renditions[j])
								&& alreadyMatched.push(j);
				}
			}
			
			return matches;
		};
		
		Repo.getChildren = function(params, callback) {
			var that = this;
			
			if (!sid || sid == '') {
				var args = arguments;
				
				getSid(function () {
					that.getChildren.apply(that, args);
				});
			} else {
				if (params.inFolderId == this.repositoryId) {
					params.inFolderId = 0;
				}
				
				jQuery.ajax({
					url		: restURL('folder/getFolders/' + params.inFolderId + '?recursive=true'),
					dataType: 'json',
					type	: 'GET',
					// TODO: move this to success when working
					error	: function () {
						callback.call(that, []);
					},
					success	: function(data) {
						if (that.handleRestResponse(data)) {
							var folders = data.folders;
							for (var i = 0, j = folders.length; i < j; i++) {
								folders[i] = that.getFolder(data.folders[i]);
								
								/*
									items.push({
									objectType	 :  'folder',
									id			 :  folder.id,
									name	 	 :  folder.name,
									repositoryId :  that.repositoryId,
									url			 :  folder.publishDir,
									hasMoreItems : (folder.subfolders && folder.subfolders.length > 0)
								});
								*/
							}
						}
						
						callback.call(that, folders);
					}
				});
			}
		};
		
		/**
		 * Get the repositoryItem with given id
		 * @param itemId {String} id of the repository item to fetch
		 * @param callback {function} callback function
		 * @return {GENTICS.Aloha.Repository.Object} item with given id
		 */
		Repo.getObjectById = function (itemId, callback) {
			var that = this;

			if (itemId.match(/^10007./)) {
				itemId = itemId.substr(6);
			}
			jQuery.ajax ({
				url: restURL('page/load/' + itemId),
				type: 'GET',
				success: function(data) {
					if (data.page) {
						callback.call(that, [that.getDocument(data.page)]);
					}
				}
			});
		};
		
		Repo.handleRestResponse = function (response) {
			if (!response) {
				this.triggerError('No response data received');
				return false;
			}
			
			if (response.responseInfo && response.responseInfo.responseCode != 'OK') {
				var l,
					msg = [],
					msgs = response.messages;
				
				if (msgs && (l = msgs.length)) {
					while (l--) {
						msgs[l].message && msg.push(msgs[l].message);
					}
					
					msg = msg.join('\n');
				} else {
					msg = 'REST-API Error';
				}
				
				this.triggerError(msg);
				
				return false;
			}
			
			return true;
		};
		
		// Repo Browser not recieving this. Is the problem here?
		Repo.triggerError = function (message) {
			var error = {
				repository : this,
				message	   : message
			};
			jQuery('body').trigger('aloha-repository-error', error);
			console.warn(error);
		};
		
	};
	
	jQuery(function () {
		jQuery('body')
			.bind('aloha', initializeRepository)
			.bind('alohacoreloaded', createRepository);
	});
	
})(window);

