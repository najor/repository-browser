/*!--------------------------------------*
  | Gentics Software GmbH                |
  +--------------------------------------+
  | Aloha.Browser                        |
  +--------------------------------------+
  | browser.js                           |
  *--------------------------------------*/

/**
 * Aloha.Browser
 *
 * The browser is an interface to interact with a Repository Managers.
 *
 * Reference:
 *		www.aloha-editor.org/wiki/Repository
 * 3rd party tools:
 *		www.jstree.com/documentation/core
 *		www.trirand.com/blog/ (jqGrid)
 *		layout.jquery-dev.net/
 */
(function BrowserClosure (window, undefined) {
	
	'use strict';
	
	var GENTICS = window.GENTICS || (window.GENTICS = {}),
		 jQuery = window.alohaQuery || window.jQuery,
		  Aloha = window.Aloha || GENTICS.Aloha; // GENTICS.Aloha is for legacy
	
	// If jQuery cannot be found then die violently!
	if (typeof jQuery != 'function') {
		throw 'jQuery cannot be found.';
		return;
	}
	
	// Create local reference for quicker look-up
	var console = window.console;
	if (typeof console == typeof undefined) {
		console = {
			log   : function () {},
			warn  : function () {},
			error : function () {}
		};
	}
	
	// ------------------------------------------------------------------------
	// Local (helper) variables
	// ------------------------------------------------------------------------
	
	var cssNS = 'aloha-browser',
		uid	  = +(new Date),
		// namespaced classnames
		nsClasses = {
			tree				: nsClass('tree'),
			'tree-header'		: nsClass('tree-header'),
			'grab-handle'		: nsClass('grab-handle'),
			shadow				: nsClass('shadow'),
			'rounded-top'		: nsClass('rounded-top'),
			list				: nsClass('list'),
			'list-altrow'		: nsClass('list-altrow'),
			'list-resizable'	: nsClass('list-resizable'),
			'list-pager'		: nsClass('list-pager'),
			'list-pager-left'	: nsClass('list-pager-left'),
			'list-btns'			: nsClass('list-btns'),
			'search-btn'		: nsClass('search-btn'),
			'search-field'		: nsClass('search-field'),
			'search-icon'		: nsClass('search-icon'),
			'close-btn'			: nsClass('close-btn'),
			btn					: nsClass('btn'),
			btns				: nsClass('btns'),
			grid				: nsClass('grid'),
			clear				: nsClass('clear'),
			inner				: nsClass('inner'),
			'modal-overlay'		: nsClass('modal-overlay'),
			'modal-window'		: nsClass('modal-window'),
			'grap-handle'		: nsClass('grap-handle')
		};
	
	// ------------------------------------------------------------------------
	// Local (helper) functions
	// ------------------------------------------------------------------------
	
	// TODO: This suffices for now. But we are to consider a more robust
	//		 templating engine.
	// TODO: Offer parameter to define left and right delimiters in case the
	//		 default "{", and "}" are problematic
	String.prototype.supplant = function (/*'lDelim, rDelim,'*/ obj) {
		return this.replace(/\{([a-z0-9\-\_]+)\}/ig, function (str, p1, offset, s) {
			var replacement = obj[p1] || str;
			return (typeof replacement === 'function')
						? replacement() : replacement;
		});
	};
	
	// It is prefered that we render strings through this function rather than
	// going directly to String.prototype.supplant
	function renderTemplate (str) {
		return (typeof str === 'string')
					? str.supplant(nsClasses)
					: str;
	};
	
	// Creates a selector string with this component's namepsace prefixed the each classname
	function nsSel () {
		var str = '',
			prx = cssNS; // ... for quicker lookup
		jQuery.each(arguments, function () {str += ' .' + prx + '-' + this;});
		return str.trim();
	};
	
	// Creates string with this component's namepsace prefixed the each classname
	function nsClass () {
		var str = '',
			prx = cssNS;
		jQuery.each(arguments, function () {str += ' ' + prx + '-' + this;});
		return str.trim();
	};
	
	// ------------------------------------------------------------------------
	// Browser constructor
	// Only instance properties are to be defined here
	// ------------------------------------------------------------------------
	var Browser = function (opts) {
		// Force the Browser function to be invoked with the "new" operator
		if (typeof this.instanceOf != 'string') {
			return new Browser(opts);
		}
		
		var that = this;
		
		// Defaults
		var options = jQuery.extend({
			// Set to true for development and debugging
			verbose: false,
			// The repository manager which this browser will interface with
			repositoryManager: Aloha.RepositoryManager,
			objectTypeFilter: [],
			renditionFilter: ['cmis:none'], // ['*']
			filter: ['url'],
			// DOMObject to which this instance of browser is bound to
			element: undefined,
			// root folder id
			rootFolderId: 'aloha',
			// root path to where Browser resources are located
			rootPath: 'Browser',
			treeWidth: 300,
			listWidth: 'auto',
			pageSize: 10,
			columns: {
				icon:	 {title: '',		width: 30,  sortable: false, resizable: false},
				name:	 {title: 'Name',	width: 250, sorttype: 'text'},
				url:	 {title: 'URL',		width: 250, sorttype: 'text'},
				preview: {title: 'Preview',	width: 200, sorttype: 'text'}
			}
		}, opts || {});
		
		// If no element, the we will an overlay element onto which we will bind
		// our browser
		if (typeof options.element != 'object') {
			options.element = this.createOverlay();
		}
		
		// Hash to store callbacks functions for each instance of browser
		this._callbacks = {};
		// Cache of repository objects
		this._objs = {};
		//
		this._searchQuery = null;
		this._orderBy = null;
		
		//---------------------------------------------------------------------
		// paging properties
		//---------------------------------------------------------------------
		this._pagingOffset = 0;
		// Total number of objects in a given folder. We don't use null because
		// isNaN(null) == false !
		this._pagingCount = undefined;
		this._pagingBtns = {
			first : null,
			end	  : null,
			next  : null,
			prev  : null
		};
		
		// TODO: Consider deprecating this
		// Register user defined implement methods and callbacks, and remove
		// them from the options object
		if (typeof options.implement === 'object') {
			jQuery.each(options.implement, function (k, v) {
				that[k] = v;
			});
			
			delete options.implement;
		}
		
		// TODO: Consider deprecating this
		if (typeof options.callbacks === 'object') {
			jQuery.each(options.callbacks, function () {
				that.callback(this[0], this[1]);
			});
			
			delete options.callbacks;
		}
		
		// Insert the remaining options as properties of this object
		jQuery.extend(this, options);
		
		this.init.apply(this, arguments);
	};
	
	/**
	 * Extend methods and properties that are to be shared across multiple
	 * instances of Browser are into the prototype object
	 */
	jQuery.extend(Browser.prototype, {
		
		instanceOf: 'Aloha.Browser',
		
		// ui components
		grid: null,
		tree: null,
		list: null,
		
		/**
		 * Called by Browser constructor function
		 *
		 * @param Mixed selector - jQuery selector. May be String, DOMObject,
		 *						   or jQuery itself
		 */
		init: function () {
			var that = this,
				tree_width = this.treeWidth,
				give = tree_width / 5;
			
			this.preloadImages();
			
			this.uid = ++uid;
			
			this.element.attr('data-aloha-browser', this.uid).html('');
			
			this.grid = this.createGrid(this.element);
			this.tree = this.createTree(this.grid.find('.ui-layout-west'));
			this.list = this.createList(this.grid.find('.ui-layout-center'));
			
			this.grid.layout({
				west__size	  : tree_width - 1,
				west__minSize : tree_width - give,
				west__maxSize : tree_width + give,
				center__size  : this.listWidth,
				paneClass	  : 'ui-layout-pane',
				resizerClass  : 'ui-layout-resizer',
				togglerClass  : 'ui-layout-toggler',
				onresize	  : function (name, element) {
					if (name == 'center') {
						that.list.setGridWidth(element.width());
					}
				}
				// , applyDefaultStyles: true // debugging
			})
			// *** Fix for a ui-layout bug in chrome ***
			.sizePane('west', tree_width);
			
			this.preventSelection();
			
			// Not working
			jQuery('body').bind('aloha-repository-error', function (error) {
				console.warn(
					'Error occured on request to repository: ', error.repository.repositoryId +
					'\nMessage: "' + error.message + '"'
				);
			});
			
			this.close();
		},
		
		preventSelection: function () {
			this.grid
				.attr('unselectable', 'on')
				.css('-moz-user-select', 'none')
				.each(function() {
					this.onselectstart = function() {
						return false;
					};
				});
		},
		
		preloadImages: function () {
			var that = this;
			jQuery.each([
				'arrow-000-medium.png',
				'arrow-180.png',
				'arrow-315-medium.png',
				'arrow-stop-180.png',
				'arrow-stop.png',
				'arrow.png',
				'control-stop-square-small.png',
				'folder-horizontal-open.png',
				'folder-open.png',
				'magnifier-left.png',
				'page.png',
				'picture.png',
				'sort-alphabet-descending.png',
				'sort-alphabet.png'
			], function () {(new Image()).src = that.rootPath + '/img/' + this;});
		},
		
		/**
		 * TODO: Is there a way we can prevent potential infinite loops caused
		 * by programmer error?
		 *
		 * @param String fn - Name of any Browser method
		 */
		trigger: function (fn, returned) {
			var cb = this._callbacks,
				i, l,
				func = cb[fn];
			
			if (typeof func === 'object') {
				for (i = 0, l = func.length; i < l; i++) {
					if (typeof func[i] === 'function') {
						func[i].call(this, returned);
					}
				}
			}
		},
		
		/**
		 * Handles the binding of callbacks to any method in the browser.
		 * Removes the necessity for functions to manually trigger callbacks
		 * events within themselves by wrapping them within an function that
		 * does it on their behalf when necessary.
		 * A user can simply do the following:
		 *		browser.callback('anyFunction', function () { alert('called back'); });
		 * This will work regardless of whether browser.anyFunction manually
		 * triggers any events.
		 *
		 * this.enableCallbacks actually does most of the heavy lifting.
		 *
		 * @param String fn - Name of any browser method
		 * @param Object cb - Callback function to invoke
		 */
		callback: function (fn, cb) {
			if (typeof this[fn] != 'function') {
				this.warn(
					'Unable to add a callback to "' + fn +
					'" because it is not a method in Aloha.Browser.'
				);
				
				return this;
			}
			
			if (typeof cb != 'function') {
				this.warn(
					'Unable to add a callback to "' + fn + '" because '	+
					'the callback object that was given is of type "'	+
					(typeof cb) + '". '									+
					'The callback object needs to be of type "function".'
				);
				
				return this;
			}
			
			if (this._callbacks[fn] == undefined) {
				if (this.enableCallbacks(fn)) {
					this._callbacks[fn] = [cb];
				}
			} else {
				this._callbacks[fn].push(cb);
			}
			
			return this;
		},
		
		/**
		 * Work-horse for this.callback method
		 */
		enableCallbacks: function (fn) {
			var browser_inst = this,
				func = this[fn];
			if (typeof func === 'function') {
				this[fn] = function () {
					var returned = func.apply(browser_inst, arguments);
					browser_inst.trigger.call(browser_inst, fn, returned);
					return returned;
				};
				
				return true;
			} else {
				this.warn(
					'Cannot enable callbacks for function "' + fn +
					'" because no such method was found in Aloha.Browser.'
				);
				
				return false;
			}
		},
		
		getRepoChildren: function (params, callback) {
			var that = this;
			this.repositoryManager.getChildren(params, function (items) {
				that.processRepoResponse(items, callback);
			});
		},
		
		queryRepository: function (params, callback) {
			var that = this;
			
			this.repositoryManager.query(params, function (response) {
				that.processRepoResponse(
					(response.results > 0) ? response.items : [],
					callback
				);
			});
		},
		
		processRepoResponse: function (items, callback) {
			var that = this,
				data = [];
			
			jQuery.each(items, function () {
				data.push(that.harvestRepoObject(this));
			});
			
			if (typeof callback === 'function') {
				callback.call(this, data);
			}
		},
		
		/**
		 * Convert a repository object into an object that can be used with our
		 * tree component. Also add a reference to this object in our objs hash.
		 * According to the Repository specification, each object will at least
		 * have the following properties at least: id, name, url, and type. Any
		 * and all other attributes are optional.
		 */
		harvestRepoObject: function (obj) {
			uid++;
			
			var repo_obj = this._objs[uid] = jQuery.extend(obj, {
				uid: uid,
				loaded: false
			});
			
			return this.processRepoObject(repo_obj);
		},
		
		/**
		 * Should return an object that is usable with your tree component
		 */
		processRepoObject: function (obj) {
			var icon = '';
			
			switch (obj.baseType) {
			case 'folder':
				icon = 'folder';
				break;
			case 'document':
				icon = 'document';
				break;
			}
			
			return {
				data: {
					title : obj.name, 
					attr  : {'data-rep-oobj': obj.uid}, 
					icon  : icon
				},
				state: (obj.hasMoreItems || obj.baseType === 'folder') ? 'closed' : null,
				resource: obj
			};
		},
		
		fetchRepoRoot: function (callback) {
			this.getRepoChildren(
				{inFolderId: this.rootFolderId},
				function (data) {
					if (typeof callback === 'function') {
						callback(data);
					}
				}
			);
		},
		
		/**
		 * User should implement this according to their needs
		 * @param Object item - Repository resource for a row
		 */
		renderRowCols: function (item) {
			var row = {};
			
			jQuery.each(this.columns, function (colName, v) {
				switch (colName) {
				case 'icon':
					row.icon = '<div class="aloha-browser-icon aloha-browser-icon-' + item.type + '"></div>';
					break;
				default:
					row[colName] = item[colName] || '--';
				}
			});
			
			return row;
		},
		
		/**
		 * User should implement this according to their needs
		 * @param Object item - Repository resource for a row
		 */
		onSelect: function (item) {},
		
		/**
		 * Fetch an object's  children if we haven't already done so
		 */
		fetchChildren: function (obj, callback) {
			var that = this;
			
			if (obj.hasMoreItems == true || obj.baseType === 'folder') {
				if (obj.loaded == false) {
					this.getRepoChildren(
						{
							inFolderId   : obj.id,
							repositoryId : obj.repositoryId
						},
						function (data) {
							that._objs[obj.uid].loaded = true;
							
							if (typeof callback === 'function') {
								callback(data);
							}
						}
					);
				}
			}
		},
		
		getObjectFromCache: function (node) {
			var uid,
				obj;
			
			if (typeof node === 'object') {
				uid = node.find('a:first').attr('data-rep-oobj');
				obj = this._objs[uid];
			}
			
			return obj;
		},
		
		rowClicked: function (event) {
			var row = jQuery(event.target).parent('tr'),
				item = null,
				uid;
			
			if (row.length > 0) {
				uid = row.attr('id');
				item = this._objs[uid];
				this.onSelect(item);
				this.close();
			}
			
			return item;
		},
		
		createTree: function (container) {
			var that = this,
				tree = jQuery(renderTemplate('<div class="{tree}">')),
				header =  jQuery(renderTemplate(
					'<div class="{tree-header} {grab-handle}">\
						Repository Browser\
					</div>'
				));
			
			container.append(header, tree);
			
			tree.height(this.grid.height() - header.outerHeight(true))
				.bind('before.jstree', function (event, data) {
					//console.log(data.func);
				})
				.bind('loaded.jstree', function (event, data) {
					jQuery('>ul>li', this).first().css('padding-top', 5);
				})
				.bind('select_node.jstree', function (event, data) {
					var node = data.rslt.obj,
						obj = that.getObjectFromCache(node);
					
					// Fix for what seems to be a bug with jsTree
					if (data.args[0].context) {return;}
					
					if (typeof obj === 'object') {
						that._pagingOffset = 0;
						that._searchQuery = null;
						that.fetchItems(obj, that.processItems);
					}
				})
				.jstree({
					rootFolderId: '3',
					plugins: ['themes', 'json_data', 'ui'],
					core: {
						// TODO: Override the standard animation by
						// setting this to 0, hiding the child node and
						// re-animating it in our own way
						animation: 250
					},
					themes: {
						theme : 'browser',
						url   : that.rootPath + '/css/jstree.css',
						dots  : true,
						icons : true
					},
					json_data: {
						data: function (/* node, callback */) {
							that.fetchSubnodes.apply(that, arguments);
						},
						correct_state: true
					},
					ui: {select_limit: 1}
				});
			
			return tree;
		},
		
		createGrid: function (container) {
			var grid = jQuery(renderTemplate(
				'<div class="{grid} {shadow} {rounded-top}"> \
					<div class="ui-layout-west"></div>		 \
					<div class="ui-layout-center"></div>	 \
				</div>'
			));
			
			container.append(grid);
			
			return grid;
		},
		
		createList: function (container) {
			var that = this,
				list = jQuery(renderTemplate(
						'<table id="jqgrid_needs_something_anything_here"\
							class="{list}"></table>'
					)),
				colNames = [''],
				colModel = [{ // This is a hidden utility column to help us with auto sorting
					name	 : 'id',
					sorttype : 'int',
					firstsortorder: 'asc',
					hidden	 : true
				}];
			
			jQuery.each(this.columns, function (k, v) {
				colNames.push(v.title);
				colModel.push({
					name	  : k,
					width	  : v.width,
					sortable  : v.sortable,
					sorttype  : v.sorttype,
					resizable : v.resizable
				});
			});
			
			container.append(
				list,
				jQuery(renderTemplate('<div id="{list-pager}">'))
			);
			
			list.jqGrid({
				datatype	: 'local',
				width		: container.width(),
				shrinkToFit	: true,
				colNames	: colNames,
				colModel	: colModel,
				caption		: '&nbsp;',
				altRows		: true,
				altclass	: nsClass('list-altrow'),
				resizeclass : nsClass('list-resizable'),
				pager		: '#' + nsClass('list-pager'), // http://www.trirand.com/jqgridwiki/doku.php?id=wiki:pager&s[]=pager
			//	rowNum		: this.pageSize,	  // # of records to view in the grid. Passed as parameter to url when retrieving data from server
				viewrecords	: true,
				// Event handlers: http://www.trirand.com/jqgridwiki/doku.php?id=wiki:events
				// fires after click on [page button] and before populating the data
				onPaging	: function (button) {},
				// called if the request fails
				loadError	: function (xhr, status, error) {},
				// Raised immediately after row was double clicked. 
				ondblClickRow: function (rowid, iRow, iCol, e) {},
				// fires after all the data is loaded into the grid and all other processes are complete
				gridComplete : function () {},
				// executed immediately after every server request 
				loadComplete : function (data) {}
			});
			
			container.find('.ui-jqgrid-bdiv').css(
				'height',
				this.grid.height() - (
					container.find('.ui-jqgrid-titlebar').outerHeight(true) +
					container.find('.ui-jqgrid-hdiv').outerHeight(true) + 
					container.find('.ui-jqgrid-pager').outerHeight(true)
				)
			);
			
			list.dblclick(function () {
				that.rowClicked.apply(that, arguments);
			});
			
			// Override jqGrid pageing
			container.find('.ui-pg-button').unbind().find('>span.ui-icon').each(function () {
				var dir = this.className.match(/ui\-icon\-seek\-([a-z]+)/)[1];
				
				that._pagingBtns[dir] = jQuery(this).parent()
					.addClass('ui-state-disabled')
					.click(function () {
						if (!jQuery(this).hasClass('ui-state-disabled')) {
							that.doPaging(dir);
						}
					});
			});
			
			// TODO: implement this once repositories can handle it, hidding it for now
			container.find('.ui-pg-input').parent().hide()
			container.find('.ui-separator').parent().css('opacity', 0).first().hide();
			container.find('#' + nsClass('list-pager-left')).hide();
			
			this.createTitlebar(container);
			
			//this.grid.find('.loading').html('Loading...');
			
			// Override jqGrid sorting
			var listProps = list[0].p;
			container.find('.ui-jqgrid-view tr:first th div').each(function(i) {
				jQuery(this).unbind().click(function (event) {
					event.stopPropagation();
					that.sortList(listProps.colModel[i], this);
				});
			});
			
			return list;
		},
		
		createTitlebar: function (container) {
			var that = this,
				search,
				bar = container.find('.ui-jqgrid-titlebar'),
				btns = jQuery(renderTemplate(
					'<div class="{btns}">							 \
						<input type="text" class="{search-field}" /> \
						<span class="{btn} {search-btn}">			 \
							<span class="{search-icon}"></span>		 \
						</span>										 \
						<span class="{btn} {close-btn}">Close</span> \
						<div class="{clear}"></div>					 \
					</div>'
				));
			
			bar.addClass(nsClass('grab-handle')).append(btns);
			bar.find(nsSel('search-btn')).click(function () {
				that.triggerSearch();
			});
			bar.find(nsSel('search-field')).keypress(function (event) {
				if (event.keyCode == 13) { // on Enter
					that.triggerSearch();
				}
			});
			bar.find(nsSel('close-btn')).click(function () {
				that.close();
			});
			bar.find(nsSel('btn')).mousedown(function () {
				jQuery(this).addClass(nsClass('pressed'));
			}).mouseup(function () {
				jQuery(this).removeClass(nsClass('pressed'));
			});
		},
		
		triggerSearch: function () {
			var search = this.grid.find('input' + nsSel('search-field'));
			
			this._pagingOffset = 0;
			this._searchQuery = search.val();
			this.fetchItems(this._currentFolderId, this.processItems);
		},
		
		/**
		 * TODO: Fix this so that sorting does toggle between desc and asc
		 *		 when you click on a column on which we were not sorting.
		 */
		sortList: function(colModel, el){
			// reset sort properties in all column headers
			jQuery('span.ui-grid-ico-sort').addClass('ui-state-disabled');
			
			colModel.sortorder = (colModel.sortorder == 'asc') ? 'desc' : 'asc';
			
			jQuery(el)
				.find('span.s-ico').show()
					.find('.ui-icon-' + colModel.sortorder)
						.removeClass('ui-state-disabled');
			
			this.setSortOrder(colModel.name, colModel.sortorder)
				.fetchItems(this._currentFolderId, this.processItems);
		},
		
		/**
		 * This function adds new sort fields into the _orderBy array.
		 * If a field already exists, it will be spliced from where it is and
		 * unshifted to the end of the array
		 */
		setSortOrder: function (by, order) {
			var sortItem = {};
			sortItem[by] = order || 'asc';
			
			var orderBy = this._orderBy || [];
			var field;
			var orderItem;
			var found = false;
			
			for (var i = 0, j = orderBy.length; i < j; i++) {
				orderItem = orderBy[i];
				
				for (field in orderItem) {
					if (field === by) {
						orderBy.splice(i, 1);
						orderBy.unshift(sortItem);
						found = true;
						break;
					}
				}
				
				if (found) {
					break;
				}
			}
			
			found || orderBy.unshift(sortItem);
			
			this._orderBy = orderBy;
			
			return this;
		},
		
		getFieldOfHeader: function (th) {
			return th.find('div.ui-jqgrid-sortable').attr('id').replace('jqgh_', '');
		},
		
		doPaging: function (dir) {
			switch (dir) {
			case 'first':
				this._pagingOffset = 0;
				break;
			case 'end':
				this._pagingOffset = this._pagingCount - this.pageSize;
				break;
			case 'next':
				this._pagingOffset += this.pageSize;
				break;
			case 'prev':
				this._pagingOffset -= this.pageSize;
				break;
			}
			
			// TODO: animate
			//var grid = this.grid.find('.ui-jqgrid-bdiv');
			//grid.animate({marginLeft: -grid.width()}, 500);
			
			this.fetchItems(this._currentFolderId, this.processItems);
		},
		
		fetchItems: function (obj, callback) {
			var that = this,
				name;
			
			switch (typeof obj) {
			case 'object':
				this._currentFolderId =  obj.id;
				name = obj.name;
				break;
			case 'string':
				name = this._currentFolderId = obj;
				break;
			default:
				name = this._currentFolderId = this.rootFolderId;
			}
			
			this.list.setCaption(
				(typeof this._searchQuery === 'string')
					? 'Searching for "' + this._searchQuery + '" in ' + name
					: 'Browsing: ' + name
			);
			
			this.list.hide();
			this.grid.find('.loading').show();
			
			this.queryRepository(
				{
					queryString		 : this._searchQuery,
					inFolderId		 : this._currentFolderId,
					skipCount		 : this._pagingOffset,
					maxItems		 : this.pageSize,
					objectTypeFilter : this.objectTypeFilter,
					renditionFilter	 : this.renditionFilter,
					filter			 : this.filter,
					orderBy			 : this._orderBy
				//	repositoryId	 : obj.repositoryId
				},
				function (data) {
					if (typeof callback === 'function') {
						callback.call(that, data);
					}
				}
			);
		},
		
		fetchSubnodes: function (node, callback) {
			if (node === -1) {
				this.fetchRepoRoot(callback);
			} else {
				var obj = this.getObjectFromCache(node);
				if (typeof obj === 'object') {
					this.fetchChildren(obj, callback);
				}
			}
		},
		
		listItems: function (items) {
			var that = this,
				data = [],			
				list = this.list.clearGridData(),
				obj;
			
			jQuery.each(items, function () {
				obj = this.resource;
				list.addRowData(
					obj.uid,
					jQuery.extend({id: obj.id}, that.renderRowCols(obj))
				);
			});
		},
		
		processItems: function (data) {
			var btns = this._pagingBtns,
				disabled = 'ui-state-disabled';
			
			this.grid.find('.loading').hide();
			this.list.show();
			
			this.listItems(data);
			
			if (this._pagingOffset <= 0) {
				btns.first.add(btns.prev).addClass();
			} else {
				btns.first.add(btns.prev).removeClass(disabled);
			}
			
			if (isNaN(this._pagingCount)) {
				btns.end.addClass(disabled);
				if (data.length == 0) {
					btns.next.addClass(disabled);
				} else {
					btns.next.removeClass(disabled);
				}
			} else if (this._pagingOffset + this.pageSize >= this._pagingCount) {
				btns.end.add(btns.next).addClass(disabled);
			} else {
				btns.end.add(btns.next).removeClass(disabled);
			}
			
			this.grid.find('.ui-paging-info').html(
				'Viewing ' +		  (data.length == 0 ? 0 : this._pagingOffset + 1)
						   + ' - '  + (data.length == 0 ? 0 : this._pagingOffset + data.length)
						   + ' of ' + (this._pagingCount || 'numerous')
			);
		},
		
		createOverlay: function () {
			var that = this;
			
			jQuery('body').append(renderTemplate(
				'<div class="{modal-overlay}" style="top: -99999px; z-index: 99999;"></div>' +
				'<div class="{modal-window}"  style="top: -99999px; z-index: 99999;"></div>'
			));
			
			jQuery(nsSel('modal-overlay')).click(function () {
				that.close();
			});
			
			return jQuery(nsSel('modal-window'));
		},
		
		setObjectTypeFilter: function (otf) {
			this.objectTypeFilter = typeof otf === 'string' ? [otf] : otf;
		},
		
		getObjectTypeFilter: function () {
			return this.objectTypeFilter;
		},
		
		show: function () {
			this.fetchRepoRoot();
			
			var el = this.element;
			
			jQuery(nsSel('modal-overlay'))
				.css({top: 0, left: 0})
				.add(el).stop().show();
			
			var	w = el.width(),
				h = el.height(),
				win	= jQuery(window);
			
			el.css({
				left : (win.width() - w) / 2,
				top  : (win.height() - h) / 3
			}).draggable({
				handle: el.find(nsSel('grab-handle'))
			}).resizable();
			
			// Do wake-up animation
			this.grid.css({
				marginTop: 30,
				opacity: 0
			}).animate({
				marginTop: 0,
				opacity: 1
			}, 1500, 'easeOutExpo');
		},
		
		close: function () {
			this.element.fadeOut(
				250, function () {
					jQuery(this).css('top', 0).hide();
					jQuery(nsSel('modal-overlay')).hide();
				}
			);
		},
		
		log: function (msg) {
			if (this.verbose == true) {
				console.log('%s LOG: ', this.instanceOf, msg);
			}
		},
		
		warn: function (msg, force) {
			if (this.verbose == true || force == true) {
				console.warn('%s WARNING: ', this.instanceOf, msg);
			}
		},
		
		error: function (msg, force) {
			if (this.verbose == true || force == true) {
				console.error('%s ERROR: ', this.instanceOf, msg);
			}
		}
		
	});
	
	jQuery(function () {
		jQuery('body').bind('aloha', function () {
			// Broadcast that this Browser is ready for use
			jQuery('body').trigger(nsClass('ready'), this);
			Aloha.Browser = Browser;
		});
		
		jQuery('bind').bind('aloha-browser-ready', function () {
			//alert(9);
		});
	});
	
	GENTICS.Browser = Browser;
	
})(window);