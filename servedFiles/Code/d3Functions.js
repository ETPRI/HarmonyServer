class d3Functions {
  constructor(parent) {
    this.parent = parent;
    this.widgetID = parent.widgetID;
    this.SVG_DOM = parent.SVG_DOM;

    this.nodeWidth = 150;
    this.nodeHeight = 30;
    this.popupWidth = 360;

    this.editDOM = document.createElement("input");
    this.editDOM.setAttribute("type", "text");
    this.editDOM.setAttribute("onblur", "app.widget('saveInput', this)");
    this.editDOM.setAttribute("onkeydown", "app.widget('lookForEnter', this, event)");
    this.editDOM.setAttribute("hidden", "true");
    this.editDOM.setAttribute("idr", "edit");
    this.SVG_DOM.appendChild(this.editDOM);

    this.roots = [];
    this.objects = [];
    this.savedObjects = [];
    this.editNode = null;
    this.newObject = null;
    this.count = 0;
    this.selectObjectCollection = new Set();
  }

  // Create new object with no node associated
  newObj() {
    const newObj = {};
    this.objects[this.count] = {};
    this.objects[this.count].JSobj = newObj; // Store JS object
    this.objects[this.count].DOMelements = {}; // Prepare to store DOM elements

    newObj.nodeID = null;
    newObj.id = this.count++;
    newObj.name = "";
    newObj.type = "";
    newObj.parent = "null";
    newObj.children = [];
    newObj.details = [];

    newObj.instance = this;

    // Remember which node to edit
    this.editNode = newObj.id;
    this.newObject = newObj;

    return newObj;
  }

  update(data) { // Creates a group for each item in the array of roots, then calls buildTree to make a tree for each group.
    // If data was passed in, that means this was called right after saving a map under a new ID.
    // Update this.parent.mapID accordingly.
    if (data && data.length > 0) {
      this.parent.mapID = data[0].mindmap.ID;
    }

    const groups = d3.select(`#svg${this.widgetID}`).selectAll("g.tree")
      .data(this.roots, function(d) {return d.name;});

    const newTrees = groups.enter()
      .append("g")
        .attr("class", "tree")
        .attr("idr", function(d) {return `tree${d.id}`})
        .attr("nodeWidth", this.nodeWidth)
        .attr("nodeHeight", this.nodeHeight)
        .attr("popupWidth", this.popupWidth)
        .attr("transform", function(d) {return "translate(" + d.x + " " + d.y + ")";} )
        .each(function(d) {
          d.instance.objects[d.id].DOMelements.tree = this;
        });

    const allTrees = newTrees.merge(groups);
    allTrees.each(this.buildTree);

    if (groups._exit) {
      groups.exit().remove();
    }

    //Truncate label names that are too long
    const texts = document.getElementsByClassName("nodeText");
    for (let i = 0; i < texts.length; i++) {
      if (texts[i].getComputedTextLength() > this.nodeWidth - 10) { // Allow a 5-px cushion
        texts[i].innerHTML += "...";
        while (texts[i].getComputedTextLength() > this.nodeWidth - 10) { // Remove one character at a time, keeping the ellipsis
          const text = texts[i];
          const currentText = text.textContent;
          const newText = currentText.substring(0, currentText.length-4) + "...";
          texts[i].textContent = newText;
        }
      }
    }

    // Same for detailText
    const detailTexts = document.getElementsByClassName("detailText");
    for (let i = 0; i < detailTexts.length; i++) {
      if (detailTexts[i].getComputedTextLength() > this.popupWidth - 10) { // Allow a 5-px cushion
        detailTexts[i].textContent += "...";
        while (detailTexts[i].getComputedTextLength() > this.popupWidth - 10) { // Remove one character at a time, keeping the ellipsis
          detailTexts[i].textContent = detailTexts[i].textContent.substring(0, detailTexts[i].textContent.length-4) + "...";
        }
      }
    }

    // Now the detail header. Tricky part here: There are two pieces of info, the name and type.
    // I'm going to truncate this normally for now (hiding the type), and discuss later.
    // Truncating just the name sounds better to me, but hard to make foolproof.
    // If I start trimming just before " Type: ", some damn fool is sure to put that in someone's name.
    const detailHeaders = document.getElementsByClassName("detailHeaderText");
    for (let i = 0; i < detailHeaders.length; i++) {
      if (detailHeaders[i].getComputedTextLength() > this.popupWidth - (2*this.nodeHeight + 10)) { // Allow a 5-px cushion; leave room for buttons
        detailHeaders[i].textContent += "...";
        while (detailHeaders[i].getComputedTextLength() > this.popupWidth - (2*this.nodeHeight + 10)) { // Remove one character at a time, keeping the ellipsis
          detailHeaders[i].textContent = detailHeaders[i].textContent.substring(0, detailHeaders[i].textContent.length-4) + "...";
        }
      }
    }

    // Finally, see if there's a new (blank) node. If so, append a text box to it to get the name,
    // then make it NOT the new node anymore. Similarly, check for a new object (whether attached to a blank node or not).
    // If there is one, make it the selected node.
    if (this.editNode) {
      const newNode = app.domFunctions.getChildByIdr(this.SVG_DOM, `node${this.editNode}`);
      this.SVG_DOM.parentElement.appendChild(this.editDOM);
      this.editDOM.hidden=false;
      const bounds = newNode.getBoundingClientRect();
      this.editDOM.setAttribute("style", `position:absolute; left:${bounds.left + window.scrollX}px; top:${bounds.top + window.scrollY}px`);
      this.editDOM.select(); // This isn't working. Back-burner goal: Figure out why; study focus in general; fix focus in dragDrop table
    }
    if (this.newObject) {
      const id = this.newObject.id;
      const select = this.objects[id].DOMelements.group;
      if (select) {
        this.parent.makeSelectedNode(select);
      }
      this.newObject = null;
    }

    if (this.selectObjectCollection.size>0) {
      for (let object of this.selectObjectCollection) {
        const id = object.id;
        const select = this.objects[id].DOMelements.group;
        if (select) {
          this.parent.selectedNodes.add(select);
          select.classList.add("selected");
        }
      }
      this.selectObjectCollection.clear();
    }
  }

  // Builds an individual tree, given the data to build it from and the group to build it in.
  // Only called by update, which passes in the appropriate values for each tree.
  // NOTE: I don't know why yet, but it seems that when building a group for each tree, data is stored in d.
  // When building a node for each leaf WITHIN a tree (in buildTree), data is stored in d.data.
  buildTree(datum, index, group) {
    const buildPopup = function(datum, index, group) {
      const texts = d3.select(this).select(".detailPopupVisible").selectAll(".detailText")
        .data(datum.data.details, function(d) {return d.field});

      texts.enter().append("text")
        .attr("class", "detailText")
        .text(function(d) {return `${d.field}: ${d.value}`})
        .attr("transform", function(d, i) {return `translate(-${d.instance.popupWidth/2}
                                                              ${20 -d.instance.nodeHeight*i})`})

      texts.text(function(d) {return `${d.field}: ${d.value}`});
      texts.exit().remove();
    }

    const tree = d3.tree()
      .nodeSize([50, 200]); // This sets the overall size of nodes, but not why sometimes they get more spaced.

    const root = d3.hierarchy(datum);
    const nodes = root.descendants(); // These two lines seem to parse the root data into a form d3.js understands

    const links = tree(root).links(); // This line gives each object x and y coordinates, and returns array of links
    const test = nodes[1];

    // Update the nodes…
    const g = d3.select(this);
    const node = g.selectAll(".node") // This means that all the nodes inside the given group are part of this tree
     .data(nodes, function(d) {return d.id || d.data.id;}) // Update what data to include. Each group represents one node.
     .attr("transform", function(d) {return "translate(" + d.y + " " + d.x + ")"; });

    // Enter any new nodes
    const nodeEnter = node.enter().append("g") // Append a "g" for each new node
      .attr("class", "node")
      .attr("transform", function(d) {return "translate(" + d.y + " " + d.x + ")"; })
      .attr("idr", function (d) {return `group${d.data.id}`; })
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.group = this;
      });

    nodeEnter.append("rect")  // notes indicator rectangle. Appended first so it's behind the main rect
      .attr("width", this.getAttribute("nodeHeight"))
      .attr("height", this.getAttribute("nodeHeight"))
      .attr("transform", `translate(${10 + parseInt(this.getAttribute("nodeWidth")) - parseInt(this.getAttribute("nodeHeight"))} -10)`)
      .attr("idr", function(d) {return `notes${d.data.id}`; })
      .attr("class", "notesRect")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.notes = this;
      });


    nodeEnter.append("rect")  // Main rectangle
      .attr("width", this.getAttribute("nodeWidth"))
      .attr("height", this.getAttribute("nodeHeight"))
      .attr("idr", function (d) {return `node${d.data.id}`; })
      .attr("class", "nodeRect")
      .attr("mousedownObj", '{"subclass":"clicks", "method":"selectNode"}')
      .attr("shiftClickObj", '{"method":"toggleSelectedNode"}')
      .attr("onmouseover", "app.widget('showButtons', this)")
      .attr("onmouseout", "app.widget('checkHideButtons', this, event)")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.node = this;
      });


    nodeEnter.append("rect")  // toggle rectangle
      .attr("width", this.getAttribute("nodeHeight")/2)
      .attr("height", this.getAttribute("nodeHeight")/2)
      .attr("idr", function(d) {return `toggle${d.data.id}`})
      .attr("transform", `translate(${this.getAttribute("nodeHeight")*5/2} ${this.getAttribute("nodeHeight")/4})`)
      .attr("mousedownObj", '{"method":"toggleChildren"}')
      .attr("onmouseover", "app.widget('toggleExplain', this, event, 'toggle')")
      .attr("onmouseout", "app.widget('toggleExplain', this, event, 'toggle'); app.widget('checkHideButtons', this, event)")
      .attr("class", "toggleRect hidden")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.toggle = this;
      });


    nodeEnter.append("text") // Toggle button text
      .attr("idr", function(d) {return `toggleText1${d.data.id}`})
      .attr("transform", `translate (${this.getAttribute("nodeHeight")*11/4} ${this.getAttribute("nodeHeight") *0.5 + 3})`)
      .attr("class", "toggleButtonText unselectable hidden")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.toggleText1 = this;
      });


    nodeEnter.append("rect") // Toggle explanation box...
      .attr("width", 320)
      .attr("height", 20)
      .attr("idr", function(d) {return `toggleExpBox${d.data.id}`})
      .attr("transform", `translate (${this.getAttribute("nodeHeight")*11/4 - 160} ${this.getAttribute("nodeHeight") *-0.5 - 10})`)
      .attr("class", "toggleExpBox hidden")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.toggleExpBox = this;
      });


    nodeEnter.append("text") // and text
      .attr("idr", function(d) {return `toggleExpln${d.data.id}`;})
      .attr("transform", `translate (${this.getAttribute("nodeHeight")*11/4} ${this.getAttribute("nodeHeight") *-0.5 + 4})`)
      .attr("class", "toggleExpln unselectable hidden")
      .text("Toggle children (disabled for nodes which have no children)")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.toggleExpln = this;
      });

    nodeEnter.append("rect")  // Show Notes rectangle
      .attr("width", this.getAttribute("nodeHeight")/2)
      .attr("height", this.getAttribute("nodeHeight")/2)
      .attr("idr", function(d) {return `note${d.data.id}`})
      .attr("transform", `translate(${this.getAttribute("nodeHeight")*7/4} ${this.getAttribute("nodeHeight")/4})`)
      .attr("mousedownObj", '{"method":"toggleNotes"}')
      .attr("onmouseover", "app.widget('toggleExplain', this, event, 'note')")
      .attr("onmouseout", "app.widget('toggleExplain', this, event, 'note'); app.widget('checkHideButtons', this, event)")
      .attr("class", "showNotesRect hidden")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.note = this;
      });

    nodeEnter.append("text") // Show notes button text
      .attr("idr", function(d) {return `showNotesText1${d.data.id}`})
      .attr("transform", `translate (${this.getAttribute("nodeHeight")*2} ${this.getAttribute("nodeHeight") *0.5 + 3})`)
      .attr("class", "notesButtonText unselectable hidden")
      .text("N")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.showNotesText1 = this;
      });

    nodeEnter.append("rect") // Notes explanation box...
      .attr("width", 180)
      .attr("height", 20)
      .attr("idr", function(d) {return `noteExpBox${d.data.id}`})
      .attr("transform", `translate (${this.getAttribute("nodeHeight")*2 - 90} ${this.getAttribute("nodeHeight") *-0.5 - 10})`)
      .attr("class", "noteExpBox hidden")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.noteExpBox = this;
      });

    nodeEnter.append("text") // ... and text
      .attr("idr", function(d) {return `noteExpln${d.data.id}`;})
      .attr("transform", `translate (${this.getAttribute("nodeHeight")*2} ${this.getAttribute("nodeHeight") *-0.5 + 4})`)
      .attr("class", "noteExpln unselectable hidden")
      .text("Toggle notes (always enabled)")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.noteExpln = this;
      });

    nodeEnter.append("rect")  // Detail display rectangle
      .attr("width", this.getAttribute("nodeHeight")/2)
      .attr("height", this.getAttribute("nodeHeight")/2)
      .attr("idr", function(d) {return `detail${d.data.id}`})
      .attr("transform", `translate(${this.getAttribute("nodeHeight")/4} ${this.getAttribute("nodeHeight")/4})`)
      .attr("onmouseover", "app.widget('toggleExplain', this, event, 'detail')")
      .attr("onmouseout", "app.widget('toggleExplain', this, event, 'detail'); app.widget('checkHideButtons', this, event)")
      .attr("mousedownObj", '{"method":"toggleDetails"}')
      .attr("class", "detailsRect hidden")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.detail = this;
      });

    nodeEnter.append("text") // Show details button text
      .attr("idr", function(d) {return `showDetailsText1${d.data.id}`})
      .attr("transform", `translate (${this.getAttribute("nodeHeight")/2} ${this.getAttribute("nodeHeight") *0.5 + 3})`)
      .attr("class", "detailButtonText unselectable hidden")
      .text("D")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.showDetailsText1 = this;
      });

    nodeEnter.append("rect") // Details explanation box...
      .attr("width", 300)
      .attr("height", 20)
      .attr("idr", function(d) {return `detailExpBox${d.data.id}`})
      .attr("transform", `translate (${this.getAttribute("nodeHeight")/2 - 150} ${this.getAttribute("nodeHeight") *-0.5 - 10})`)
      .attr("class", "detailExpBox hidden")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.detailExpBox = this;
      });

    nodeEnter.append("text") // ... and text
      .attr("idr", function(d) {return `detailExpln${d.data.id}`;})
      .attr("transform", `translate (${this.getAttribute("nodeHeight")*1/2} ${this.getAttribute("nodeHeight") *-0.5 + 4})`)
      .attr("class", "detailExpln unselectable hidden")
      .text("Toggle details (disabled for labels with nothing attached)")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.detailExpln = this;
      });

    nodeEnter.append("rect")  // Edit rectangle
      .attr("width", this.getAttribute("nodeHeight")/2)
      .attr("height", this.getAttribute("nodeHeight")/2)
      .attr("idr", function(d) {return `edit${d.data.id}`})
      .attr("transform", `translate(${this.getAttribute("nodeHeight")} ${this.getAttribute("nodeHeight")/4})`)
      .attr("onmouseover", "app.widget('toggleExplain', this, event, 'edit')")
      .attr("onmouseout", "app.widget('toggleExplain', this, event, 'edit'); app.widget('checkHideButtons', this, event)")
      .attr("mousedownObj", '{"subclass":"clicks", "method":"editLabel"}') // Change the name
      .attr("class", "editRect hidden")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.edit = this;
      });

    nodeEnter.append("text") // Edit button text
      .attr("idr", function(d) {return `editText1${d.data.id}`})
      .attr("transform", `translate (${this.getAttribute("nodeHeight")*5/4} ${this.getAttribute("nodeHeight") *0.5 + 3})`)
      .attr("class", "editText unselectable hidden")
      .text("E")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.editText1 = this;
      });

    nodeEnter.append("rect") // Edit explanation box...
      .attr("width", 440)
      .attr("height", 20)
      .attr("idr", function(d) {return `editExpBox${d.data.id}`})
      .attr("transform", `translate (${this.getAttribute("nodeHeight")*5/4 - 220} ${this.getAttribute("nodeHeight") *-0.5 - 10})`)
      .attr("class", "editExpBox hidden")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.editExpBox = this;
      });

    nodeEnter.append("text") // ... and text
      .attr("idr", function(d) {return `editExpln${d.data.id}`;})
      .attr("transform", `translate (${this.getAttribute("nodeHeight")*5/4} ${this.getAttribute("nodeHeight") *-0.5 + 4})`)
      .attr("class", "editExpln unselectable hidden")
      .text("Edit label (disabled for labels with nodes attached, which always show that node's name)")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.editExpln = this;
      })



    nodeEnter.append("g") // Create a detail popup group with a rectangle in it
      .attr("idr", function(d) {return `popupGroup${d.data.id}`})
      .attr("class", "detailPopupVisible hidden")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.popupGroup = this;
      })
      .append("rect")                                             // Large popup rectangle...
        .attr("idr", function(d) {return`popupRect${d.data.id}`})
        .attr("class", "detailPopup")
        .each(function(d) {
          d.data.instance.objects[d.data.id].DOMelements.popupRect = this;
        })
      .select(function() { return this.parentNode; })
        .append("rect")                                           // Header rectangle
        .attr("idr", function (d) {return `detailHeader${d.data.id}`})
        .attr("class", "detailHeader")
        .attr("height", this.getAttribute("nodeHeight"))
        .attr("width", this.getAttribute("popupWidth"))
        .each(function(d) {
          d.data.instance.objects[d.data.id].DOMelements.detailHeader = this;
        })
      .select(function() { return this.parentNode; })
        .append("rect")                                           // disassociate button
        .attr("idr", function(d) {return `disassociate${d.data.id}`})
        .attr("class", "disassociateButton")
        .attr("height", this.getAttribute("nodeHeight"))
        .attr("width", this.getAttribute("nodeHeight"))
        .attr("mousedownObj", '{"method":"disassociate"}')
        .each(function(d) {
          d.data.instance.objects[d.data.id].DOMelements.disassociate = this;
        })
      .select(function() { return this.parentNode; })             // disassociate text
        .append("text")
        .attr("dx", function(d) {return `-${d.data.instance.popupWidth - d.data.instance.nodeHeight/2}`;})
        .attr("idr", function(d) {return `disassociateText${d.data.id}`;})
        .attr("class", "disassociateText unselectable")
        .text("X")
        .each(function(d) {
          d.data.instance.objects[d.data.id].DOMelements.disassociateText = this;
        })
      .select(function() { return this.parentNode; })
        .append("rect")                                           // Show Node button
        .attr("idr", function(d) {return `showNode${d.data.id}`})
        .attr("class", "showNodeButton")
        .attr("height", this.getAttribute("nodeHeight"))
        .attr("width", this.getAttribute("nodeHeight"))
        .attr("mousedownObj", '{"method":"showNode"}')
        .each(function(d) {
          d.data.instance.objects[d.data.id].DOMelements.showNode = this;
        })
      .select(function() { return this.parentNode; })             // Show Node text
        .append("text")
        .attr("dx", function(d) {return `-${d.data.instance.nodeHeight/2}`;})
        .attr("idr", function(d) {return `showNodeText${d.data.id}`;})
        .attr("class", "showNodeText unselectable")
        .text("+")
        .each(function(d) {
          d.data.instance.objects[d.data.id].DOMelements.showNodeText = this;
        })
      .select(function() {return this.parentNode; })
        .append("text")                                           // Text in header
        .attr("dx", function(d) {return `-${d.data.instance.popupWidth/2}`;})
        .attr("class", "detailHeaderText unselectable")
        .attr("idr", function(d) {return `detailHeaderText${d.data.id}`})
        .text(function(d) { return `Name: ${d.data.name} Type: ${d.data.type}`; })
        .each(function(d) {
          d.data.instance.objects[d.data.id].DOMelements.detailHeaderText = this;
        });

    nodeEnter.append("text") // Add text
      .attr("dx", this.getAttribute("nodeWidth")/2)
      .attr("dy", this.getAttribute("nodeHeight")/2 + 6)
      .attr("class", "nodeText unselectable")
      .attr("idr", function(d) {return `text${d.data.id}`})
      .text(function(d) { return d.data.name; })
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.text = this;
      });

    const allNodes = nodeEnter.merge(node);

    allNodes.selectAll(".nodeRect")
      .classed("changedData", function(d) {
        const saved = d.data.instance.savedObjects[d.data.id];
        if (saved) { // If saved data for this node exists and...
          if (saved.name != d.data.name) return true; // the name...
          if (saved.type != d.data.type) return true; // type...
          if (saved.nodeID != d.data.nodeID) return true; // node ID...
          if (saved.parent != d.data.parent) return true; // parent...
          if (saved.notes != d.data.notes) return true; // or notes have changed, it's changed data.
        }
        return false; // Otherwise it's not changed (it's either new or the same as it was before).
      })
      .classed("newData", function(d) {if (d.data.instance.savedObjects[d.data.id]) return false; else return true;})

    allNodes.selectAll(".notesRect")
      .classed("noNotes", function(d) {if (d.data.notes) return false; else return true;})
      .classed("notesExist", function(d) {if (d.data.notes) return true; else return false;});

    allNodes.selectAll(".toggleRect")
        .classed("inactive", function(d) {
            if ((!d.data.children || d.data.children.length == 0)
            && (!d.data._children || d.data._children.length == 0))
              return true; else return false;
          });

    allNodes.selectAll(".toggleButtonText")
      .classed("inactiveText", function(d) {
          if ((!d.data.children || d.data.children.length == 0)
          && (!d.data._children || d.data._children.length == 0))
            return true; else return false;
        })
      .text(function(d) {if (d.data.children && d.data.children.length > 0) return "-"; else return "+";});

    allNodes.selectAll(".detailsRect")
      .classed("inactive", function(d) {if (d.data.type == "") return true; else return false});

    allNodes.selectAll(".detailButtonText")
      .classed("inactiveText", function(d) {if (d.data.type == "") return true; else return false});

    allNodes.selectAll(".editRect")
      .classed("inactive", function(d) {if (d.data.nodeID) return true; else return false});

    allNodes.selectAll(".editText")
      .classed("inactiveText", function(d) {if (d.data.nodeID) return true; else return false});

    allNodes.selectAll(".detailPopup")
      .attr("width", this.getAttribute("popupWidth"))
      // This is fairly complicated. It allots one line (of height nodeHeight) for each entry in the details object,
      // plus an additional line for the node's name and type.
      .attr("height", function(d) {return (d.data.details.length + 1) * d.data.instance.nodeHeight;})
      .attr("transform", function(d) {return `translate(-${d.data.instance.popupWidth}
                                                        -${d.data.details.length * d.data.instance.nodeHeight})`;});

    allNodes.selectAll(".detailHeader")
      .attr("transform", function(d) {return `translate(-${d.data.instance.popupWidth}
                                                        -${d.data.details.length * d.data.instance.nodeHeight})`});

    allNodes.selectAll(".disassociateButton")
      .attr("transform", function(d) {return `translate(-${d.data.instance.popupWidth}
                                                        -${d.data.details.length * d.data.instance.nodeHeight})`});

    allNodes.selectAll(".disassociateText").attr("dy", function(d) {return -1*(d.data.details.length * d.data.instance.nodeHeight - 20);});

    allNodes.selectAll(".showNodeButton")
      .attr("transform", function(d) {return `translate(-${d.data.instance.nodeHeight}
                                                        -${d.data.details.length * d.data.instance.nodeHeight})`});

    allNodes.selectAll(".showNodeText").attr("dy", function(d) {return -1*(d.data.details.length * d.data.instance.nodeHeight - 20);});

    allNodes.selectAll(".detailHeaderText")
      .text(function(d) { return `Name: ${d.data.name} Type: ${d.data.type}`; })
      .attr("dy", function(d) {return -d.data.instance.nodeHeight * (d.data.details.length - 0.5) + 6});

    allNodes.each(buildPopup);

    // Update text
    d3.selectAll(".node").each(function(d) { // For each node
      d3.select(this).select('.nodeText')  // Should select the text of the node
      .text(function(d) {return d.data.name}); // Should update the text
    });

    node.exit().remove();

    // Update the links…
    const link = g.selectAll("path.link")
      .data(links);

    link.enter().insert("path", "g")
        .attr("class", "link")
        .attr("idr", function(d) {return `link${d.source.data.id}to${d.target.data.id}`; })
      .merge(link)
        .attr("d", d3.linkHorizontal()
          .x(function(d) { return d.y; })
          .y(function(d) { return d.x; })
          .source(function(d) { return {x: d.source.x + 15, y: d.source.y + 120}; })
          .target(function(d) { return {x: d.target.x + 15, y: d.target.y}; }))
        .attr("transform", "translate(0 0)");

      g.selectAll("path.link")
        .attr("idr", function(d) {return `link${d.source.data.id}to${d.target.data.id}`; })
      link.exit().remove();
  }
}
