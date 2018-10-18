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

  createLongestIncreasingSubsequence(d) { // d is the data for this node. CAN ALSO ACCESS APP
    const d3 = d.data.instance;
    const current = d3.objects[d.data.id].JSobj;
    const saved = d3.savedObjects[d.data.id];

    let currentChildren = [];
    if (current) {
      currentChildren = current.children || current._children;
    }

    let savedChildren = [];
    if (saved) {
      savedChildren = saved.children || saved._children;
    }

    // commonChildren should be the intersection of current and saved children, in the order they appear in currentChildren
    const savedIndices = [];
    for (let i = 0; i < savedChildren.length; i++) {
      savedIndices[i] = savedChildren[i].id;
    }

    let commonChildren = [];
    if (currentChildren && savedChildren) {
      commonChildren = currentChildren.filter(value => -1 !== savedIndices.indexOf(value.id));
    }

    // If this label has at least two children that were also present at last save,
    // we need to find its longest increasing subsequence.
    if (commonChildren.length > 1) {
      const objLIS = app.createLIS(commonChildren, function (x, y) {return savedIndices.indexOf(x.id) - savedIndices.indexOf(y.id)});
      current.LIS = objLIS.map(x=>x.id); // Store LIS consisting of IDs only
    } // end if (at least two common children; need to find LIS)
  }

  isRearranged(d) {
    const d3 = d.data.instance;
    const current = d3.objects[d.data.id].JSobj;
    const saved = d3.savedObjects[d.data.id];
    const currentParentID = current.parent;
    const savedParentID = saved.parent;
    const currentParent = d3.objects[currentParentID];
    //  If this label still has the same non-null parent, and that parent has a LIS array which doesn't include this label
    // (meaning that it has at least two children and this label is NOT one of the ones which is considered "in order"),
    // then this node should be marked as rearranged, so return true. Otherwise, return false.
    if (currentParentID == savedParentID && currentParent && currentParent.JSobj.LIS && !(currentParent.JSobj.LIS.includes(d.data.id))) {
      return true;
    }
    else return false;
  }

  update() { // Creates a group for each item in the array of roots, then calls buildTree to make a tree for each group.
    const groups = d3.select(`#svg${this.widgetID}`).selectAll("g.tree")
      .data(this.roots, function(d) {return d.id;});

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
    if (this.editNode != null) {
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
  buildTree(datum) {
    const buildDetails = function(datum) {
      const table = document.createElement('table');
      table.classList.add('hidden');
      const header = document.createElement('thead');
      table.appendChild(header);
      let showButton = "";
      if (datum.data.type === "link") { // URLs get an Open Link button
        showButton = `<input type="button" value="Open link" onclick="app.widget('showNode', this)"
        GUID="${datum.data.nodeID}" DBType="link" link="${datum.data.details[0].value}">`;// For now, assume the uri is the first (and only) detail
      }
      else if (datum.data.type === "calendar" || datum.data.type === "mindmap") { // These get two buttons - to show normally or as a node
        showButton = `<input type="button" value="Open" onclick="app.widget('showNode', this)"
        GUID="${datum.data.nodeID}" DBType="${datum.data.DBType}">
        <input type="button" value="Open as node" onclick="app.widget('showNode', this)"
        GUID="${datum.data.nodeID}" DBType="${datum.data.DBType}">`;

      }
      else if (datum.data.type !== "" && datum.data.type !== "file") { // Files and plain text get no button; everything else gets "Open Node"
        showButton = `<input type="button" value="Open node" onclick="app.widget('showNode', this)"
        GUID="${datum.data.nodeID}" DBType="${datum.data.DBType}">`;
      }
      header.innerHTML =
        `<tr><th colspan="2">
          ${datum.data.name}: ${datum.data.type} ${showButton}
          <input type="button" value="Disassociate" idr="disassociate${datum.data.id}" onclick="app.widget('disassociate', this)">
        </tr></th>`;
      const body = document.createElement('tbody');
      table.appendChild(body);
      for (let i = 0; i < datum.data.details.length; i++) {
        const d = datum.data.details[i];
        const row = document.createElement('tr');
        body.appendChild(row);
        row.innerHTML = `<th>${d.field}</th><td>${d.value}</td>`;
      }
      datum.data.instance.objects[datum.data.id].DOMelements.detailsTable = table;
      const detailsPane = datum.data.instance.parent.detailsPane;
      detailsPane.appendChild(table);
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
      .attr("transform", `translate (${this.getAttribute("nodeHeight")*5/4} ${this.getAttribute("nodeHeight") * 0.5 + 3})`)
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

    nodeEnter.append("rect") // restore rectangle
      .attr("width", this.getAttribute("nodeWidth")/2)
      .attr("height", this.getAttribute("nodeHeight") - 10)
      .attr("idr", function(d) {return `restore${d.data.id}`})
      .attr("transform", `translate (${this.getAttribute("nodeWidth")/4} 5)`)
      .attr("onmouseover", "app.widget('toggleExplain', this, event, 'restore')")
      .attr("onmouseout", "app.widget('toggleExplain', this, event, 'restore'); app.widget('checkHideButtons', this, event)")
      .attr("mousedownObj", '{"subclass":"clicks", "method":"restore"}')
      .attr("class", "restoreRect hidden")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.restore = this;
      });

    nodeEnter.append("text") // Restore rectangle text
      .attr("idr", function(d) {return `restoreText${d.data.id}`})
      .attr("transform", `translate (${this.getAttribute("nodeWidth")/2} 20)`)
      .attr("class", "restoreText unselectable hidden")
      .text("Restore")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.restoreText = this;
      });

    nodeEnter.append("rect") // Restore explanation box...
      .attr("width", 440)
      .attr("height", 20)
      .attr("idr", function(d) {return `restoreExpBox${d.data.id}`})
      .attr("transform", `translate (${this.getAttribute("nodeWidth")/2 - 220} ${this.getAttribute("nodeHeight") *-0.5 - 10})`)
      .attr("class", "editExpBox hidden")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.restoreExpBox = this;
      });

    nodeEnter.append("text") // ... and text
      .attr("idr", function(d) {return `restoreExpln${d.data.id}`;})
      .attr("transform", `translate (${this.getAttribute("nodeWidth")/2} ${this.getAttribute("nodeHeight") *-0.5 + 4})`)
      .attr("class", "editExpln unselectable hidden")
      .text("Restore this label and its children (remove red formatting and don't delete at next save)")
      .each(function(d) {
        d.data.instance.objects[d.data.id].DOMelements.restoreExpln = this;
      })

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

    allNodes.each(this.__data__.instance.createLongestIncreasingSubsequence);

    allNodes.selectAll(".nodeRect")
      .classed("changedData", function(d) {
        const saved = d.data.instance.savedObjects[d.data.id];
        if (saved) { // If saved data for this node exists and...
          if (saved.name != d.data.name) return true; // the name...
          if (saved.type != d.data.type) return true; // type...
          if (saved.nodeID != d.data.nodeID) return true; // node ID...
          if (saved.parent != d.data.parent) return true; // parent...
          if (saved.notes != d.data.notes) return true; // or notes have changed...
          if (d.data.instance.isRearranged(d)) return true; // or it's been rearranged, it's changed data.
        }
        return false; // Otherwise it's not changed (it's either new or the same as it was before).
      })
      .classed("deletedData", function(d) {if (d.data.deleted) return d.data.deleted; else return false;})
      .classed("newData", function(d) {if (d.data.instance.savedObjects[d.data.id]) return false; else return true;});

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

    allNodes.selectAll(".editRect")
      .classed("inactive", function(d) {if (d.data.nodeID) return true; else return false});

    allNodes.selectAll(".editText")
      .classed("inactiveText", function(d) {if (d.data.nodeID) return true; else return false});

    allNodes.selectAll(".showNodeButton")
      .attr("transform", function(d) {return `translate(-${d.data.instance.nodeHeight}
                                                        -${d.data.details.length * d.data.instance.nodeHeight})`});

    allNodes.selectAll(".showNodeText").attr("dy", function(d) {return -1*(d.data.details.length * d.data.instance.nodeHeight - 20);});

    allNodes.each(buildDetails);


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
