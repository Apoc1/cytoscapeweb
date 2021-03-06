;(function($, $$){
		
	// CySelector
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	function CySelector(cy, onlyThisGroup, selector){
		
		if( cy === undefined || cy.$ == null ){
			$$.console.error("A selector must have a reference to the core");
			return;
		}
		
		if( selector === undefined && onlyThisGroup !== undefined ){
			selector = onlyThisGroup;
			onlyThisGroup = undefined;
		}
		
		var self = this;
		
		self._private = {
			selectorText: null,
			invalid: true,
			cy: cy
		}
	
		function newQuery(){
			return {
				classes: [],
				colonSelectors: [],
				data: [],
				group: onlyThisGroup,
				ids: [],
				meta: [],
				collection: null,
				filter: null
			};
		}
		
		if( selector == null || ( $$.is.string(selector) && selector.match(/^\s*$/) ) ){
			
			if( onlyThisGroup == null ){
				// ignore
				self.length = 0;
			} else {
				
				// NOTE: need to update this with fields as they are added to logic in else if
				self[0] = newQuery();
				self.length = 1;
			}
							
		} else if( $$.is.element( selector ) ){
			var collection = new $$.CyCollection(self.cy(), [ selector ]);
			
			self[0] = newQuery();
			self[0].collection = collection;
			self.length = 1;
			
		} else if( $$.is.collection( selector ) ){
			self[0] = newQuery();
			self[0].collection = selector;
			self.length = 1;
			
		} else if( $$.is.fn(selector) ) {
			self[0] = newQuery();
			self[0].filter = selector;
			self.length = 1;
			
		} else if( $$.is.string(selector) ){
		
			// these are the actual tokens in the query language
			var metaChar = "[\\!\\\"\\#\\$\\%\\&\\\'\\(\\)\\*\\+\\,\\.\\/\\:\\;\\<\\=\\>\\?\\@\\[\\]\\^\\`\\{\\|\\}\\~]"; // chars we need to escape in var names, etc
			var variable = "(?:[\\w-]|(?:\\\\"+ metaChar +"))+"; // a variable name
			var comparatorOp = "=|\\!=|>|>=|<|<=|\\$=|\\^=|\\*="; // binary comparison op (used in data selectors)
			var boolOp = "\\?|\\!|\\^"; // boolean (unary) operators (used in data selectors)
			var string = '"(?:\\\\"|[^"])+"' + "|" + "'(?:\\\\'|[^'])+'"; // string literals (used in data selectors) -- doublequotes | singlequotes
			var number = "\\d*\\.\\d+|\\d+|\\d*\\.\\d+[eE]\\d+"; // number literal (used in data selectors) --- e.g. 0.1234, 1234, 12e123
			var value = string + "|" + number; // a value literal, either a string or number
			var meta = "degree|indegree|outdegree"; // allowed metadata fields (i.e. allowed functions to use from $$.CyCollection)
			var separator = "\\s*,\\s*"; // queries are separated by commas; e.g. edge[foo = "bar"], node.someClass
			var className = variable; // a class name (follows variable conventions)
			var id = variable; // an element id (follows variable conventions)
			
			// when a token like a variable has escaped meta characters, we need to clean the backslashes out
			// so that values get compared properly in CySelector.filter()
			function cleanMetaChars(str){
				return str.replace(new RegExp("\\\\(" + metaChar + ")", "g"), "\1");
			}
			
			// add @ variants to comparatorOp
			$.each( comparatorOp.split("|"), function(i, op){
				comparatorOp += "|@" + op;
			} );
			
			// NOTE: add new expression syntax here to have it recognised by the parser;
			// a query contains all adjacent (i.e. no separator in between) expressions;
			// the current query is stored in self[i] --- you can use the reference to `this` in the populate function;
			// you need to check the query objects in CySelector.filter() for it actually filter properly, but that's pretty straight forward
			var exprs = {
				group: {
					regex: "(node|edge)",
					populate: function( group ){
						this.group = group + "s";
					}
				},
				
				state: {
					regex: "(:selected|:unselected|:locked|:unlocked|:visible|:hidden|:grabbed|:free|:removed|:inside|:grabbable|:ungrabbable|:animated|:unanimated)",
					populate: function( state ){
						this.colonSelectors.push( state );
					}
				},
				
				id: {
					regex: "\\#("+ id +")",
					populate: function( id ){
						this.ids.push( cleanMetaChars(id) );
					}
				},
				
				className: {
					regex: "\\.("+ className +")",
					populate: function( className ){
						this.classes.push( cleanMetaChars(className) );
					}
				},
				
				dataExists: {
					regex: "\\[\\s*("+ variable +")\\s*\\]",
					populate: function( variable ){
						this.data.push({
							field: cleanMetaChars(variable)
						});
					}
				},
				
				dataCompare: {
					regex: "\\[\\s*("+ variable +")\\s*("+ comparatorOp +")\\s*("+ value +")\\s*\\]",
					populate: function( variable, comparatorOp, value ){
						this.data.push({
							field: cleanMetaChars(variable),
							operator: comparatorOp,
							value: value
						});
					}
				},
				
				dataBool: {
					regex: "\\[\\s*("+ boolOp +")\\s*("+ variable +")\\s*\\]",
					populate: function( boolOp, variable ){
						this.data.push({
							field: cleanMetaChars(variable),
							operator: boolOp
						});
					}
				},
				
				metaCompare: {
					regex: "\\{\\s*("+ meta +")\\s*("+ comparatorOp +")\\s*("+ number +")\\s*\\}",
					populate: function( meta, comparatorOp, number ){
						this.meta.push({
							field: cleanMetaChars(meta),
							operator: comparatorOp,
							value: number
						});
					}
				}
			};
			
			self._private.selectorText = selector;
			var remaining = selector;
			var i = 0;
			
			// of all the expressions, find the first match in the remaining text
			function consumeExpr(){
				var expr;
				var match;
				var name;
				
				$.each(exprs, function(n, e){
					var m = remaining.match(new RegExp( "^" + e.regex ));
					
					if( m != null ){
						match = m;
						expr = e;
						name = n;
						
						var consumed = m[0];
						remaining = remaining.substring( consumed.length );								
						
						return false;
					}
				});
				
				return {
					expr: expr,
					match: match,
					name: name
				};
			}
			
			// consume all leading whitespace
			function consumeWhitespace(){
				var match = remaining.match(/^\s+/);
				
				if( match ){
					var consumed = match[0];
					remaining = remaining.substring( consumed.length );
				}
			}
			
			// consume query separators
			function consumeSeparators(){
				var match = remaining.match(new RegExp( "^" + separator ));
				
				// if we've matched to a separator, consume it
				if( match ){
					var consumed = match[0];
					remaining = remaining.substring( consumed.length );
					self[++i] = newQuery();
				}
			}
			
			self[0] = newQuery(); // get started
			
			consumeWhitespace(); // get rid of leading whitespace
			for(;;){
				consumeSeparators();
				
				var check = consumeExpr();
				
				if( check.name == "group" && onlyThisGroup != null && self[i].group != onlyThisGroup ){
					$$.console.error("Group `%s` conflicts with implicit group `%s` in selector `%s`", self[i].group, onlyThisGroup, selector);
					return;
				}
				
				if( check.expr == null ){
					$$.console.error("The selector `%s` is invalid", selector);
					return;
				} else {
					var args = [];
					for(var j = 1; j < check.match.length; j++){
						args.push( check.match[j] );
					}
					
					// let the token populate the selector object (i.e. in self[i])
					check.expr.populate.apply( self[i], args );
				}
				
				// we're done when there's nothing left to parse
				if( remaining.match(/^\s*$/) ){
					break;
				}
			}
			
			self.length = i + 1;
			
		} else {
			$$.console.error("A selector must be created from a string; found %o", selector);
			return;
		}

		self._private.invalid = false;
		
	}
	$.cytoscapeweb.CySelector = CySelector; // expose
	
	CySelector.prototype.cy = function(){
		return this._private.cy;
	};
	
	CySelector.prototype.size = function(){
		return this.length;
	};
	
	CySelector.prototype.eq = function(i){
		return this[i];
	};
	
	// get elements from the core and then filter them
	CySelector.prototype.find = function(){
		// TODO impl
	};
	
	// filter an existing collection
	CySelector.prototype.filter = function(collection, addLiveFunction){
		var self = this;
		
		// don't bother trying if it's invalid
		if( self._private.invalid ){
			return new $$.CyCollection( self.cy() );
		}
		
		var selectorFunction = function(i, element){
			for(var j = 0; j < self.length; j++){
				var query = self[j];
				
				// check group
				if( query.group != null && query.group != element._private.group ){
					continue;
				}
				
				// check colon selectors
				var allColonSelectorsMatch = true;
				for(var k = 0; k < query.colonSelectors.length; k++){
					var sel = query.colonSelectors[k];
					var renderer = self.cy().renderer(); // TODO remove reference after refactoring
					
					switch(sel){
					case ":selected":
						allColonSelectorsMatch = element.selected();
						break;
					case ":unselected":
						allColonSelectorsMatch = !element.selected();
						break;
					case ":locked":
						allColonSelectorsMatch = element.locked();
						break;
					case ":unlocked":
						allColonSelectorsMatch = !element.locked();
						break;
					case ":visible":
						allColonSelectorsMatch = renderer.elementIsVisible(element);
						break;
					case ":hidden":
						allColonSelectorsMatch = !renderer.elementIsVisible(element);
						break;
					case ":grabbed":
						allColonSelectorsMatch = element.grabbed();
						break;
					case ":free":
						allColonSelectorsMatch = !element.grabbed();
						break;
					case ":removed":
						allColonSelectorsMatch = element.removed();
						break;
					case ":inside":
						allColonSelectorsMatch = !element.removed();
						break;
					case ":grabbable":
						allColonSelectorsMatch = element.grabbable();
						break;
					case ":ungrabbable":
						allColonSelectorsMatch = !element.grabbable();
						break;
					case ":animated":
						allColonSelectorsMatch = element.animated();
						break;
					case ":unanimated":
						allColonSelectorsMatch = !element.animated();
						break;
					}
					
					if( !allColonSelectorsMatch ) break;
				}
				if( !allColonSelectorsMatch ) continue;
				
				// check id
				var allIdsMatch = true;
				for(var k = 0; k < query.ids.length; k++){
					var id = query.ids[k];
					var actualId = element._private.data.id;
					
					allIdsMatch = allIdsMatch && (id == actualId);
					
					if( !allIdsMatch ) break;
				}
				if( !allIdsMatch ) continue;
				
				// check classes
				var allClassesMatch = true;
				for(var k = 0; k < query.classes.length; k++){
					var cls = query.classes[k];
					
					allClassesMatch = allClassesMatch && element.hasClass(cls);
					
					if( !allClassesMatch ) break;
				}
				if( !allClassesMatch ) continue;
				
				// generic checking for data/metadata
				function operandsMatch(params){
					var allDataMatches = true;
					for(var k = 0; k < query[params.name].length; k++){
						var data = query[params.name][k];
						var operator = data.operator;
						var value = data.value;
						var field = data.field;
						var matches;
						
						if( operator != null && value != null ){
							
							var fieldStr = "" + params.fieldValue(field);
							var valStr = "" + eval(value);
							
							var caseInsensitive = false;
							if( operator.charAt(0) == "@" ){
								fieldStr = fieldStr.toLowerCase();
								valStr = valStr.toLowerCase();
								
								operator = operator.substring(1);
								caseInsensitive = true;
							}
							
							if( operator == "=" ){
								operator = "==";
							}
							
							switch(operator){
							case "*=":
								matches = fieldStr.search(valStr) >= 0;
								break;
							case "$=":
								matches = new RegExp(valStr + "$").exec(fieldStr) != null;
								break;
							case "^=":
								matches = new RegExp("^" + valStr).exec(fieldStr) != null;
								break;
							default:
								// if we're doing a case insensitive comparison, then we're using a STRING comparison
								// even if we're comparing numbers
								if( caseInsensitive ){
									// eval with lower case strings
									var expr = "fieldStr " + operator + " valStr";
									matches = eval(expr);
								} else {
									// just eval as normal
									var expr = params.fieldRef(field) + " " + operator + " " + value;
									matches = eval(expr);
								}
								
							}
						} else if( operator != null ){
							switch(operator){
							case "?":
								matches = params.fieldTruthy(field);
								break;
							case "!":
								matches = !params.fieldTruthy(field);
								break;
							case "^":
								matches = params.fieldUndefined(field);
								break;
							}
						} else { 	
							matches = !params.fieldUndefined(field);
						}
						
						if( !matches ){
							allDataMatches = false;
							break;
						}
					} // for
					
					return allDataMatches;
				} // operandsMatch
				
				// check data matches
				var allDataMatches = operandsMatch({
					name: "data",
					fieldValue: function(field){
						return element._private.data[field];
					},
					fieldRef: function(field){
						return "element._private.data." + field;
					},
					fieldUndefined: function(field){
						return element._private.data[field] === undefined;
					},
					fieldTruthy: function(field){
						if( element._private.data[field] ){
							return true;
						}
						return false;
					}
				});
				
				if( !allDataMatches ){
					continue;
				}
				
				// check metadata matches
				var allMetaMatches = operandsMatch({
					name: "meta",
					fieldValue: function(field){
						return element[field]();
					},
					fieldRef: function(field){
						return "element." + field + "()";
					},
					fieldUndefined: function(field){
						return element[field]() == undefined;
					},
					fieldTruthy: function(field){
						if( element[field]() ){
							return true;
						}
						return false;
					}
				});
				
				if( !allMetaMatches ){
					continue;
				}
				
				// check collection
				if( query.collection != null ){
					var matchesAny = query.collection._private.ids[ element.id() ] != null;
					
					if( !matchesAny ){
						continue;
					}
				}
				
				// check filter function
				if( query.filter != null && element.collection().filter( query.filter ).size() == 0 ){
					continue;
				}
				
				// we've reached the end, so we've matched everything for this query
				return true;
			}
			
			return false;
		};
		
		if( self._private.selectorText == null ){
			selectorFunction = function(){ return true; };
		}
		
		var filteredCollection = collection.filter(selectorFunction);
		
		if(addLiveFunction){
			
			var key = self.selector();
			var structs = self.cy()._private; // TODO remove ref to `structs` after refactoring
			
			filteredCollection.live = function(events, data, callback){
				
				var evts = events.split(/\s+/);
				$.each(evts, function(i, event){
				
					if( event == "" ){
						return;
					}
					
					if( callback === undefined ){
						callback = data;
						data = undefined;
					}
					
					if( structs.live[event] == null ){
						structs.live[event] = {};
					}
					
					if( structs.live[event][key] == null ){
						structs.live[event][key] = [];
					}
					
					structs.live[event][key].push({
						callback: callback,
						data: data
					});
					
				});						
				
				return this;
			};
			
			filteredCollection.die = function(event, callback){
				if( event == null ){
					$.each(structs.live, function(event){
						if( structs.live[event] != null ){
							delete structs.live[event][key];
						}
					});
				} else {
					var evts = event.split(/\s+/);
					
					$.each(evts, function(j, event){
						if( callback == null ){
							if( structs.live[event] != null ){
								delete structs.live[event][key];
							}
						} else if( structs.live[event] != null && structs.live[event][key] != null ) {
							for(var i = 0; i < structs.live[event][key].length; i++){
								if( structs.live[event][key][i].callback == callback ){
									structs.live[event][key].splice(i, 1);
									i--;
								}
							}
						}
					});
					
				}
				
				return this;
			};
		}
		
		return filteredCollection;
	};
	
	// ith query to string
	CySelector.prototype.selector = function(){
		
		var str = "";
		
		function clean(obj){
			if( $$.is.string(obj) ){
				return obj;
			} 
			return "";
		}
		
		for(var i = 0; i < this.length; i++){
			var query = this[i];
			
			var group = clean(query.group);
			str += group.substring(0, group.length - 1);
			
			for(var j = 0; j < query.data.length; j++){
				var data = query.data[j];
				str += "[" + data.field + clean(data.operator) + clean(data.value) + "]"
			}
			
			for(var j = 0; j < query.colonSelectors.length; j++){
				var sel = query.colonSelectors[i];
				str += sel;
			}
			
			for(var j = 0; j < query.ids.length; j++){
				var sel = "#" + query.ids[i];
				str += sel;
			}
			
			for(var j = 0; j < query.classes.length; j++){
				var sel = "." + query.classes[i];
				str += sel;
			}
			
			if( this.length > 1 && i < this.length - 1 ){
				str += ", ";
			}
		}
		
		return str;
	};
	
})(jQuery, jQuery.cytoscapeweb);
