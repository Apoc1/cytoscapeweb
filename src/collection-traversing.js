;(function($, $$){
	
	$$.fn.collection({
		nodes: function(selector){
			return this.filter(function(i, element){
				return element.isNode();
			});
		}
	});

	$$.fn.collection({
		edges: function(selector){
			return this.filter(function(i, element){
				return element.isEdge();
			});
		}
	});

	$$.fn.collection({
		filter: function(filter){
			var cy = this.cy();
			
			if( $$.is.fn(filter) ){
				var elements = [];
				this.each(function(i, element){
					if( filter.apply(element, [i, element]) ){
						elements.push(element);
					}
				});
				
				return new $$.CyCollection(this.cy(), elements);
			} else if( $$.is.string(filter) ){
				return new $$.CySelector(this.cy(), filter).filter(this);
			} else if( filter === undefined ){
				return this;
			}

			$$.console.warn("You must pass a function or a selector to `filter`");
			return new $$.CyCollection( this.cy() );
		}
	});

	$$.fn.collection({	
		not: function(toRemove){
			
			if( toRemove == null ){
				return this;
			} else {
			
				if( $$.is.string(toRemove) ){
					toRemove = this.filter(toRemove);
				}
				
				var elements = [];
				toRemove = toRemove.collection();
				
				this.each(function(i, element){
					
					var remove = toRemove._private.ids[ element.id() ];					
					if( !remove ){
						elements.push( element.element() );
					}
					
				});
				
				return new $$.CyCollection(this.cy(), elements);
			}
			
		}
	});
	
	$$.fn.collection({
		intersect: function( other ){
			var self = this;
			
			// if a selector is specified, then filter by it
			if( $$.is.string(other) ){
				var selector = other;
				return this.filter( selector );
			}
			
			if( $$.is.element(other) ){
				other = other.collection();
			}
			
			var elements = [];
			var col1 = this;
			var col2 = other;
			var col1Smaller = this.size() < other.size();
			var ids1 = col1Smaller ? col1._private.ids : col2._private.ids;
			var ids2 = col1Smaller ? col2._private.ids : col1._private.ids;
			
			$.each(ids1, function(id){
				if( ids2[ id ] ){
					elements.push( self.cy().getElementById(id) );
				}
			});
			
			return new $$.CyCollection( this.cy(), elements );
		}
	});
	
	$$.fn.collection({
		add: function(toAdd){
			var self = this;			
			
			if( toAdd == null ){
				return this;
			}
			
			if( $$.is.string(toAdd) ){
				var selector = toAdd;
				toAdd = this.cy().elements(selector);
			}
			toAdd = toAdd.collection();
			
			var elements = [];
			var ids = {};
		
			function add(element){
				if( element == null ){
					return;
				}
				
				if( ids[ element.id() ] == null ){
					elements.push(element);
					ids[ element.id() ] = true;
				}
			}
			
			// add own
			this.each(function(i, element){
				add(element);
			});
			
			// add toAdd
			var collection = toAdd.collection();
			collection.each(function(i, element){
				add(element);
			});
			
			return new $$.CyCollection(this.cy(), elements);
		}
	});

	$$.fn.collection({
		neighborhood: function(selector){
			var elements = [];
			
			this.nodes().each(function(i, node){
				node.connectedEdges().each(function(j, edge){
					var otherNode = edge.connectedNodes().not(node).element();
					elements.push( otherNode ); // add node 1 hop away
					
					// add connected edge
					elements.push( edge.element() );
				});
			});
			
			return this.connectedNodes().add( new $$.CyCollection( this.cy(), elements ) ).filter( selector );
		}
	});
	$$.fn.collection({ neighbourhood: function(selector){ return this.neighborhood(selector); } });
	
	$$.fn.collection({
		closedNeighborhood: function(selector){
			return new $$.CySelector(this.cy(), selector).filter( this.neighborhood().add(this) );
		}
	});
	$$.fn.collection({ closedNeighbourhood: function(selector){ return this.closedNeighborhood(selector); } });
	
	$$.fn.collection({
		openNeighborhood: function(selector){
			return this.neighborhood(selector);
		}
	});
	$$.fn.collection({ openNeighbourhood: function(selector){ return this.openNeighborhood(selector); } });
	
	$$.fn.collection({
		source: function(){
			var ele = this.element();

			if( ele.isNode() ){
				$$.console.warn("Can call `source()` only on edges---tried to call on node `%s`", ele._private.data.id);
				return new $$.CyCollection( ele.cy() );
			}
			
			return ele.cy().getElementById( ele._private.data.source ).collection();
		}
	});
	
	$$.fn.collection({
		target: function(){
			var ele = this.element();
			
			if( ele.isNode() ){
				$$.console.warn("Can call `target()` only on edges---tried to call on node `%s`", ele._private.data.id);
				return new $$.CyCollection( ele.cy() );
			}
			
			return ele.cy().getElementById( ele._private.data.target ).collection();
		}
	});
	
	$$.fn.collection({
		edgesWith: defineEdgesWithFunction()
	});
	
	$$.fn.collection({
		edgesTo: defineEdgesWithFunction({
			include: function( node, otherNode, edgeStruct ){
				return edgeStruct.source;
			}
		})
	});
	
	$$.fn.collection({
		edgesFrom: defineEdgesWithFunction({
			include: function( node, otherNode, edgeStruct ){
				return edgeStruct.target;
			}
		})
	});
	
	function defineEdgesWithFunction( params ){
		var defaults = {
			include: function( node, otherNode, edgeStruct ){
				return true;
			}
		};
		params = $.extend(true, {}, defaults, params);
		
		return function(otherNodes){
			var elements = [];
			
			this.nodes().each(function(i, node){
				otherNodes.nodes().each(function(j, otherNode){
					$.each( node.element()._private.edges[ otherNode.id() ], function(edgeId, edgeStruct){
						if( params.include( node, otherNode, edgeStruct ) ){
							elements.push( otherNode.element() );
						}
					} );
				});
			});
			
			return new $$.CyCollection( this.cy(), elements );
		};
	}
	
	$$.fn.collection({
		connectedEdges: function( selector ){
			var elements = [];
			
			this.nodes().each(function(i, node){
				$.each(node.element()._private.edges, function(otherNodeId, edgesById){
					$.each(edgesById, function(edgeId, edgeStruct){
						elements.push( edgeStruct.edge );
					});
				});
			});
			
			return new $$.CyCollection( this.cy(), elements ).filter( selector );
		}
	});
	
	$$.fn.collection({
		connectedNodes: function( selector ){
			var elements = [];
			
			this.edges().each(function(i, edge){
				elements.push( edge.source().element() );
				elements.push( edge.target().element() );
			});
			
			return new $$.CyCollection( this.cy(), elements ).filter( selector );
		}
	});
	
	$$.fn.collection({
		parallelEdges: defineParallelEdgesFunction()
	});
	
	$$.fn.collection({
		codirectedEdges: defineParallelEdgesFunction({
			include: function( source, target, edgeStruct ){
				return edgeStruct.source;
			}
		})
	});
	
	function defineParallelEdgesFunction(params){
		var defaults = {
			include: function( source, target, edgeStruct ){
				return true;
			}
		};
		params = $.extend(true, {}, defaults, params);
		
		return function( selector ){
			var elements = [];
			
			this.edges().each(function(i, edge){
				var src = edge.source().element();
				var tgt = edge.target().element();
				
				// look at edges between src and tgt
				$.each( src._private.edges[ tgt.id() ], function(id, edgeStruct){
					if( params.include(src, tgt, edgeStruct) ){
						elements.push( edgeStruct.edge );
					}
				});
			});
			
			return new $$.CyCollection( this.cy(), elements ).filter( selector );
		};
	
	}
	
})(jQuery, jQuery.cytoscapeweb);