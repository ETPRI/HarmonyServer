class nodeFunctions {
  constructor() {
  }

  // BASIC FUNCTIONS
  /*
  Creates or merges a new node
  The object describes a node to be created, and can contain any of these keys:
  dataObj.type = string representing the type of node (ex. "people"). If not given, the node will have no type (NOT recommended, may not work in all databases)
  dataObj.name = alias for the node - the name the node will be returned as. If not given, the node will be called "node".
  dataObj.properties = an object containing properties the object should have. Example: {name:"Amy", age:31}
  dataObj.return = boolean setting whether to return the node. Defaults to true.
  dataObj.merge = boolean setting whether to merge the node (that is, if it already exists, don't create a new one). Defaults to false.
  */
  createNode(dataObj, methodObj, methodName, ...args) {
    const strings = {ret:"", where:""}; // where won't be used here, but I'm including it for consistency
    const node = this.buildSearchString(dataObj, strings, "where", "node");
    let command = "create";
    if (dataObj.merge === true) {
      command = "merge";
    }

    if (strings.ret != "") {
      strings.ret = `return ${strings.ret}`;
    }

    const query = `${command} (${node}) ${strings.ret}`;
    this.sendQuery(query, methodObj, methodName, ...args);
  }

  /*
  Deletes one or more nodes
  The object describes a node to be deleted, and can contain any of these keys:
  dataObj.type = string representing the type of node (ex. "people"). If not given, ANY type will match
  dataObj.id = the ID of the node
  dataObj.properties = an object containing properties the object should have. Example: {name:"Amy", age:31}
  dataObj.return = boolean setting whether to try to return the node. Included because it does have an effect,
  but not really useful for deletion - returning something after deleting it produces an empty object.
  ALL nodes which match the given description - whether that's 0, 1, or all of them - will be deleted.
  */
  deleteNode(dataObj, methodObj, methodName, ...args) {
    const strings = {ret:"", where:""};
    const node = this.buildSearchString(dataObj, strings, "where", "node");

    const query = `match (${node}) detach delete node`;
    this.sendQuery(query, methodObj, methodName, ...args);
  }

  /*
  Finds or changes a node.
  The object includes a smaller object describing a node, and an array of changes.
  The node object is called node, and can contain any of these keys:
  dataObj.node.type = string representing the type of node (ex. "people"). If not given, ANY type will match
  dataObj.node.name = alias for the node - the name the node will be returned as. If not given, the node will be called "node".
  dataObj.node.id = the ID of the node
  dataObj.node.properties = an object containing properties the object should have. Example: {name:"Amy", age:31}
  dataObj.node.return = boolean setting whether to return the node. Defaults to true.
  The change array is called changes, and contains objects representing properties to set.
  (If no changes are sent, just returns any nodes without "return" set to false without making any changes.)
  Each object in the array has a property and a value, and may contain a boolean stating whether it's a string (default is true).
  Example: [{property:"name", value:"Amanda"}, {property:"age", value:32, string:false}]
  ANY nodes which match the other values (type, ID and properties) will have the changes applied to them - no matter how many such nodes there are.
  */
  changeNode(dataObj, methodObj, methodName, ...args) {
    const strings = {ret:"", where:""};
    // Build the string representing the node - what goes in the parentheses
    const node = this.buildSearchString(dataObj.node, strings, "where", "node");

    // Build the string representing the changes - what comes after the SET keyword
    // dataObj.changes should be an array, each entry in which includes a property, a value and possibly a string boolean
    let changes ="";
    if (dataObj.changes) {
      for (let i = 0; i < dataObj.changes.length; i++) {
        let value = `"${dataObj.changes[i].value}"`;
        if (dataObj.changes[i].string === false) { // default is that the new value is a string, but can be overridden
          value = `${dataObj.changes[i].value}`;
        }

        if (changes == "") {
          changes = `set node.${dataObj.changes[i].property} = ${value}`;
        }
        else changes += `, node.${dataObj.changes[i].property} = ${value}`;
      }
    }

    if (strings.ret != "") {
      strings.ret = `return ${strings.ret}`;
    }

    const query = `match (${node}) ${strings.where} ${changes} ${strings.ret}`;
    this.sendQuery(query, methodObj, methodName, ...args);
  }

  /*
  Creates or merges a relation between two existing nodes.
  The object includes three smaller objects describing the start node, end node and relation.
  The start node object is called "from", and can contain any of these keys:
  dataObj.from.type = string representing the type of node (ex. "people"). If not given, ANY type will match
  dataObj.from.name = alias for the node - the name the node will be returned as. If not given, the node will be called "from".
  dataObj.from.id = the ID of the node
  dataObj.from.properties = an object containing properties the object should have. Example: {name:"Amy", age:31}
  dataObj.from.return = boolean setting whether to return the node. Defaults to true.

  The end node is caled "to", and can contain the same keys "from" can: type, name, id, properties and return.
  The only difference is that if no name is supplied for the end node, it is called "to" instead of "from".

  The relation node is called "rel", and can contain any of these keys:
  dataObj.rel.type = the type of the relation. MUST be supplied in Neo4j as a relation MUST have a type.
  dataObj.rel.name = alias for the relation. If not supplied, the relation will be called "rel".
  dataObj.rel.properties = an object containing properties the relation should have. Example: {username: "admin", password:"admin"}
  dataObj.rel.merge = boolean setting whether to merge the relation (if it already exists, don't make a new one). Default: false
  dataObj.rel.return = boolean setting whether to return the relation. Defaults to true.

  The data object can also contain a boolean, dataObj.distinct. It defaults to false. If true, then duplicate items are removed from the results.
  */
  createRelation(dataObj, methodObj, methodName, ...args) {
    const strings = {ret:"", where:""};

    // Build the string representing the "from" node - what goes in the first set of parentheses
    let from = "";
    if (dataObj.from) {
      from = this.buildSearchString(dataObj.from, strings, "where", "from");
    }
    else {
      from = this.buildSearchString({}, strings, "where", "from");
    }

    // Build the string representing the "to" node - what goes in the second set of parentheses
    let to = "";
    if (dataObj.to) {
      to = this.buildSearchString(dataObj.to, strings, "where", "to");
    }
    else {
      to = this.buildSearchString({}, strings, "where", "to");
    }

    // Build the string representing the relation - what goes in the brackets
    let rel = "";
    if (dataObj.rel) {
      rel = this.buildSearchString(dataObj.rel, strings, "where", "rel");
    }
    else {
      rel = this.buildSearchString({}, strings, "where", "rel");
    }


    let command = "create";
    if (dataObj.rel && dataObj.rel.merge === true) {
      command = "merge";
    }

    if (strings.ret != "" && dataObj.distinct) {
      strings.ret = `return distinct ${strings.ret}`;
    }
    else if (strings.ret != "") {
      strings.ret = `return ${strings.ret}`;
    }

    const query = `match (${from}), (${to}) ${strings.where} ${command} (from)-[${rel}]->(to) ${strings.ret}`;
    this.sendQuery(query, methodObj, methodName, ...args);
  }

  /*
  Deletes a relation between two nodes.
  The object includes three smaller objects describing the start node, end node and relation.
  The start node object is called "from", and can contain any of these keys:
  dataObj.from.type = string representing the type of node (ex. "people"). If not given, ANY type will match
  dataObj.from.name = alias for the node - the name the node will be returned as. If not given, the node will be called "from".
  dataObj.from.id = the ID of the node
  dataObj.from.properties = an object containing properties the object should have. Example: {name:"Amy", age:31}
  dataObj.from.return = boolean setting whether to return the node. Defaults to true.

  The end node object is caled "to", and can contain the same keys "from" can: type, name, id, properties and return.
  The only difference is that if no name is supplied for the end node, it is called "to" instead of "from".

  The relation object is called "rel", and can contain most of the same keys as "from" and "to": type, name, id, and properties.
  It can include a "return" boolean as well, but that won't tell you anything about the relation except that it existed -
  if you try to return a relation after deleting it, you get an empty object.
  If no name is supplied, the relation is called "rel".
  */
  deleteRelation(dataObj, methodObj, methodName, ...args) {
    // These strings are stored in an object so they can be passed in and out of methods and updated
    const strings = {ret:"", where:""};

    // Build the string representing the "from" node - what goes in the first set of parentheses
    let from = "";
    if (dataObj.from) {
      from = this.buildSearchString(dataObj.from, strings, "where", "from");
    }
    else {
      from = this.buildSearchString({}, strings, "where", "from");
    }

    // Build the string representing the "to" node - what goes in the second set of parentheses
    let to = "";
    if (dataObj.to) {
      to = this.buildSearchString(dataObj.to, strings, "where", "to");
    }
    else {
      to = this.buildSearchString({}, strings, "where", "to");
    }

    // Build the string representing the relation - what goes in the brackets
    let rel = "";
    if (dataObj.rel) {
      rel = this.buildSearchString(dataObj.rel, strings, "where", "rel");
    }
    else {
      rel = this.buildSearchString({}, strings, "where", "rel");
    }

    if (strings.ret != "" && dataObj.distinct) {
      strings.ret = `return distinct ${strings.ret}`;
    }
    else if (strings.ret != "") {
      strings.ret = `return ${strings.ret}`;
    }

    const query = `match (${from})-[${rel}]->(${to}) ${strings.where} delete rel ${strings.ret}`;
    this.sendQuery(query, methodObj, methodName, ...args);
  }

  /*
  Finds or edits a relation between two nodes.
  The object includes three smaller objects describing the start node, end node and relation, and an array of changes.
  The start node object is called "from", and can contain any of these keys:
  dataObj.from.type = string representing the type of node (ex. "people"). If not given, ANY type will match
  dataObj.from.name = alias for the node - the name the node will be returned as. If not given, the node will be called "from".
  dataObj.from.id = the ID of the node
  dataObj.from.properties = an object containing properties the object should have. Example: {name:"Amy", age:31}
  dataObj.from.return = boolean setting whether to return the node. Defaults to true.

  The end node object is caled "to", and can contain the same keys "from" can: type, name, id, properties and return.
  The only difference is that if no name is supplied for the end node, it is called "to" instead of "from".

  The relation object is called "rel", and can contain the same keys as "from" and "to": type, name, id, properties, return.
  If no name is supplied, the relation is called "rel".

  The changes array contains objects representing changes to make to the nodes or relation.
  Each object contains the item to be changed ("from", "to" or "rel"), a property and a value,
  and may include a boolean stating whether the value is a string (default: true).
  Example for updating login information: [{item:"rel", property:"username", value:"Amy"}, {item:"rel", property:"password", value:"myPassword"}]
  */
  changeRelation(dataObj, methodObj, methodName, ...args) {
    // These strings are stored in an object so they can be passed in and out of methods and updated
    const strings = {ret:"", where:""};

    // Build the string representing the "from" node - what goes in the first set of parentheses
    let from = "";
    if (dataObj.from) {
      from = this.buildSearchString(dataObj.from, strings, "where", "from");
    }
    else {
      from = this.buildSearchString({}, strings, "where", "from");
    }

    // Build the string representing the "to" node - what goes in the second set of parentheses
    let to = "";
    if (dataObj.to) {
      to = this.buildSearchString(dataObj.to, strings, "where", "to");
    }
    else {
      to = this.buildSearchString({}, strings, "where", "to");
    }

    // Build the string representing the relation - what goes in the brackets
    let rel = "";
    if (dataObj.rel) {
      rel = this.buildSearchString(dataObj.rel, strings, "where", "rel");
    }
    else {
      rel = this.buildSearchString({}, strings, "where", "rel");
    }

    // Build the string representing the changes - what comes after the SET keyword
    let changes = "";
    if (dataObj.changes) {
     changes = this.buildChangesString(dataObj.changes);
    }

    if (strings.ret != "" && dataObj.distinct) {
      strings.ret = `return distinct ${strings.ret}`;
    }
    else if (strings.ret != "") {
      strings.ret = `return ${strings.ret}`;
    }

    const query = `match (${from})-[${rel}]->(${to}) ${strings.where} ${changes} ${strings.ret}`;
    this.sendQuery(query, methodObj, methodName, ...args);
  }

  // ADVANCED FUNCTIONS

  /*
  Finds or edits a node with an optional relation.
  That is, one node MUST exist. The other node, and the relation between them, MAY exist.
  The object includes three smaller objects, describing the required node, optional node and optional relation,
  and an array of changes to make.
  The required node object is called "required", and can contain any of these keys:
  dataObj.required.type = string representing the type of node (ex. "people"). If not given, ANY type will match
  dataObj.required.name = alias for the node - the name the node will be returned as. If not given, the node will be called "required".
  dataObj.required.id = the ID of the node
  dataObj.required.properties = an object containing properties the object should have. Example: {name:"Amy", age:31}
  dataObj.required.return = boolean setting whether to return the node. Defaults to true.

  The optional node object is called "optional" and can contain the same keys as "required".
  If no name is given, it is called "optional".

  The relation object is called "rel" and can contain all the same keys as "required" and "optional" - type, name, id, properties and return.
  In addition, it can contain a "direction" key setting the direction of the link from the required node to the optional node.
  Default is "right" - that is, (required)-[rel]->(optional). If "direction" is set to "left", the relation goes (required)<-[rel]-(optional).
  I'm not terribly happy about the terminology here - if anyone has better ideas for these names than "right" and "left", let me know.

  The changes array contains objects representing changes to make to the nodes or relation.
  Each object contains the item to be changed ("required", "optional" or "rel"), a property and a value,
  and may include a boolean stating whether the value is a string (default: true).
  Example (made up, because I don't think any calls to this currently make changes):
  [{item:"required", property:"name", value:"newName"}, {item:"optional", property:"count", value:10, string:false}]
  */
  findOptionalRelation(dataObj, methodObj, methodName, ...args) {
    // These strings are stored in an object so they can be passed in and out of methods and updated
    // Need TWO where clauses - one for the required node, one for the optional node and relation
    const strings = {ret:"", reqWhere:"", optWhere:""};

    // Build the string representing the "from" node - what goes in the first set of parentheses
    let required = "";
    if (dataObj.required) {
      required = this.buildSearchString(dataObj.required, strings, "reqWhere", "required");
    }
    else {
      required = this.buildSearchString({}, strings, "reqWhere", "required");
    }

    // Build the string representing the "to" node - what goes in the second set of parentheses
    let optional = "";
    if (dataObj.optional) {
      optional = this.buildSearchString(dataObj.optional, strings, "optWhere", "optional");
    }
    else {
      optional = this.buildSearchString({}, strings, "optWhere", "optional");
    }

    // Build the string representing the relation - what goes in the brackets
    let rel = "";
    if (dataObj.rel) {
      rel = this.buildSearchString(dataObj.rel, strings, "optWhere", "rel");
    }
    else {
      rel = this.buildSearchString({}, strings, "optWhere", "rel");
    }

    // Build the string representing the changes - what comes after the SET keyword
    let changes = "";
    if (dataObj.changes) {
     changes = this.buildChangesString(dataObj.changes);
    }

    // default is that the relation starts on the required node, but if the direction is specified, it can go backward
    let arrow = `-[${rel}]->`;
    if (dataObj.rel && dataObj.rel.direction && dataObj.rel.direction == "left") {
      arrow = `<-[${rel}]-`;
    }

    strings.ret = `return ${strings.ret}`;

    const query = `match (${required}) ${strings.reqWhere}
                   optional match (required)${arrow}(${optional}) ${changes} ${strings.ret}`;
    this.sendQuery(query, methodObj, methodName, ...args);
  }

  /*
  The most complicated general function, finds three nodes and two relations in the pattern (start)-[rel1]->(middle)-[rel2]-(end).
  The object includes five smaller objects describing the nodes and relations, and an array of changes.
  The start node object is called "start", and can contain any of these keys:
  dataObj.start.type = string representing the type of node (ex. "people"). If not given, ANY type will match
  dataObj.start.name = alias for the node - the name the node will be returned as. If not given, the node will be called "from".
  dataObj.start.id = the ID of the node
  dataObj.start.properties = an object containing properties the object should have. Example: {name:"Amy", age:31}
  dataObj.start.return = boolean setting whether to return the node. Defaults to true.

  The middle node object is caled "middle", and can contain the same keys "start" can: type, name, id, properties and return.
  The only difference is that if no name is supplied for the end node, it is called "middle" instead of "start".

  The end node object is caled "end", and can contain the same keys "start" and "middle" can: type, name, id, properties and return.
  The only difference is that if no name is supplied for the end node, it is called "end".

  The first relation object is called "rel1", and can contain the same keys as the node objects: type, name, id, properties, return.
  If no name is supplied, the relation is called "rel1".

  The second relation object is called "rel2", and can contain the same keys as the node objects: type, name, id, properties, return.
  If no name is supplied, the relation is called "rel2".

  The changes array contains objects representing changes to make to the nodes or relation.
  Each object contains the item to be changed ("from", "to" or "rel"), a property and a value,
  and may include a boolean stating whether the value is a string (default: true).
  Example for updating a view: [{item:"rel2", property:"comment", value:"New Comment"}, {item:"middle", property:"order", value:[1, 2, 3], string:false}]
  */
  changeTwoRelPattern(dataObj, methodObj, methodName, ...args) {
    const strings = {ret:"", where:""};

    // Build the string representing the "start" node - what goes in the first set of parentheses
    let start = "";
    if (dataObj.start) {
      start = this.buildSearchString(dataObj.start, strings, "where", "start");
    }
    else {
      start = this.buildSearchString({}, strings, "where", "start");
    }

    // Build the string representing the "middle" node - what goes in the second set of parentheses
    let middle = "";
    if (dataObj.middle) {
      middle = this.buildSearchString(dataObj.middle, strings, "where", "middle");
    }
    else {
      middle = this.buildSearchString({}, strings, "where", "middle");
    }

    // Build the string representing the "end" node - what goes in the third set of parentheses
    let end = "";
    if (dataObj.end) {
      end = this.buildSearchString(dataObj.end, strings, "where", "end");
    }
    else {
      end = this.buildSearchString({}, strings, "where", "end");
    }

    // Build the string representing the first relation - what goes in the first set of brackets
    let rel1 = "";
    if (dataObj.rel1) {
      rel1 = this.buildSearchString(dataObj.rel1, strings, "where", "rel1");
    }
    else {
      rel1 = this.buildSearchString({}, strings, "where", "rel1");
    }

    // Build the string representing the second relation - what goes in the second set of brackets
    let rel2 = "";
    if (dataObj.rel2) {
      rel2 = this.buildSearchString(dataObj.rel2, strings, "where", "rel2");
    }
    else {
      rel2 = this.buildSearchString({}, strings, "where", "rel2");
    }

    // Build the string representing the changes - what comes after the SET keyword
    let changes = "";
    if (dataObj.changes) {
     changes = this.buildChangesString(dataObj.changes);
    }

    if (strings.ret != "" && dataObj.distinct) {
      strings.ret = `return distinct ${strings.ret}`;
    }
    else if (strings.ret != "") {
      strings.ret = `return ${strings.ret}`;
    }

    const query = `match (${start})-[${rel1}]->(${middle})-[${rel2}]->(${end}) ${strings.where} ${changes} ${strings.ret}`;
    this.sendQuery(query, methodObj, methodName, ...args);
  }

  // SPECIFIC FUNCTIONS
  /*
  A specific function for running a search for a widgetTableNodes widget. Searches ALWAYS look for a single node of a given type,
  which has not been trashed by the logged-in user. If the node type is "people", then the search also looks for an optional link
  to a permissions table to see whether the person is a user or admin. While other search functions require exact matches,
  this one allows for comparisons like greater than/less than (for numbers) and start, midddle or end (for strings). It also
  orders the results and sets a limit on how many there are. The data object contains the following keys:
  dataObj.type = the type of node to search for
  dataObj.name = alias to use for the nodes
  dataObj.where = object containing search criteria for the nodes. Each object contains a key which is the name of a property,
    and a smaller object with the following keys:
    dataObj.where[property].fieldType = "string" if the field is a string field, or "number" if the field is numerical
    dataObj.where[property].value = the value the user typed in the search field
    dataObj.where[property].searchType = the value the user selected from the dropdown list. Can be "S", "M", "E" or "=" for strings, or "<", ">", "<=", ">=" or "=" for numbers.
    Example of a where object for a people search: {name:{fieldType:"string", value:"Fiori", searchType:"E"}, age:{fieldType:"number", value:18, searchType:">"}}
  dataObj.orderBy = string representing the fields to order the search results by.
  dataObj.limit = number representing the maximum number of rows to return.
  */
  tableNodeSearch(dataObj, methodObj, methodName, ...args) {
    // Example search string:
    // match (n:type) where n.numField < value and n.stringField =~(?i)value
    // optional match (n)-[:Permissions]->(perm:LoginTable) return n, perm.name as permissions
    // order by first, second, third limit 9

    // Notes: use *. for wildcard in string search. Only search for permissions if type = people.
    // Regexes apparently have to be in a where clause, not in curly braces, so for simplicity, put all criteria in where clause.

    // Build the where clause, starting with requirement that current user has not trashed this node
    let where = `where ID(a)=${app.login.userID} and not (a)-[:Trash]->(${dataObj.name}) and `;

    for (let field in dataObj.where) {
      if (dataObj.where[field].fieldType == "string") {
        // =~: regex; (?i): case insensitive; #s# and #E#: placeholders for start and end variables
        // (start and end variables can be ".*", meaning "any string", or "", meaning "nothing")
        const w = `${dataObj.name}.${field}=~"(?i)#s#${dataObj.where[field].value}#E#" and `;
        let w1="";
        switch(dataObj.where[field].searchType) {
          case "S":    // start
            // Anything can come AFTER the specified value, but nothing BEFORE it (it starts the desired string)
            w1 = w.replace('#s#',"").replace('#E#','.*');    break;
          case "M":    // middle
            // Anything can come before or after the specified value (as long as it appears anywhere in the string)
            w1 = w.replace('#s#',".*").replace('#E#','.*');  break;
          case "E":    // end
            // Anything can come BEFORE the specified value, but nothing AFTER it (it ends the desired string)
            w1 = w.replace('#s#',".*").replace('#E#','');    break;
          case "=":    // equal to
            // NOTHING can come before OR after the specified value (string must match it exactly)
            w1 = w.replace('#s#',"").replace('#E#','');      break;
          default:
            app.error("Error: search type for a string field is not 'S', 'M', 'E' or '='.");
        }
        where += w1;
      }
      else { // number field
        where += `${dataObj.name}.${field} ${dataObj.where[field].searchType} ${dataObj.where[field].value} and `;
      }
    }

    if (dataObj.owner) {
      const w = `o.name=~"(?i)#s#${dataObj.owner.value}#E#" and `;
      let w1="";
      switch(dataObj.owner.searchType) {
        case "S":    // start
          // Anything can come AFTER the specified value, but nothing BEFORE it (it starts the desired string)
          w1 = w.replace('#s#',"").replace('#E#','.*');    break;
        case "M":    // middle
          // Anything can come before or after the specified value (as long as it appears anywhere in the string)
          w1 = w.replace('#s#',".*").replace('#E#','.*');  break;
        case "E":    // end
          // Anything can come BEFORE the specified value, but nothing AFTER it (it ends the desired string)
          w1 = w.replace('#s#',".*").replace('#E#','');    break;
        case "=":    // equal to
          // NOTHING can come before OR after the specified value (string must match it exactly)
          w1 = w.replace('#s#',"").replace('#E#','');      break;
        default:
          app.error("Error: search type for a string field is not 'S', 'M', 'E' or '='.");
      }
      where += w1;
    }

    if (dataObj.permissions) {
      switch (dataObj.permissions) {
        case "users":
          where += `t.name = 'User' and `;
          break;
        case "admins":
          where += `t.name = 'Admin' and `;
          break;
        case "allUsers": // These do nothing - they're only here so that a REAL default can produce an error message
        case "all":
          break;
        default:
          app.error("Error: Search type for permissions is not users, admins, users and admins, or all people")
      }
    }

    // Remove the last " and " from the where clause
    where = where.slice(0, -5);

    let permCheck = "";
    let ret = `return ${dataObj.name}`;
    if (dataObj.type == "people") {
      permCheck = `optional match (${dataObj.name})-[:Permissions]->(perm:LoginTable)`;
      ret += `, perm.name as permissions`;
    }

    let ownerCheck = "";
    if (dataObj.type == "mindmap") {
      ownerCheck = `optional match (${dataObj.name})-[:Owner]->(owner:people)`;
      ret += `, owner.name as owner`;
    }

    let query = `match (${dataObj.name}:${dataObj.type})`;

    if (dataObj.owner) {
      query += `-[:Owner]->(o:people)`;
    }

    if (dataObj.permissions && dataObj.permissions != "all") {
      query += `-[:Permissions]->(t:LoginTable)`; // require a permissions link
    }

    query += `, (a) ${where} ${permCheck} ${ownerCheck}
                   ${ret} order by ${dataObj.orderBy} limit ${dataObj.limit}`;
    this.sendQuery(query, methodObj, methodName, ...args);
  }

  /*
  A specific function for creating a connection between two nodes in the view of the logged-in user. This requires creating
  that user's view of each of those nodes (if it doesn't already exist), then linking each node to the view of the other node,
  and returning one of the new links (the one going to the view which called this function in the first place) so that its
  id can be added to that view's ordering.
  The data object contains the following keys:
  startID: The ID of the node the user believes the relation starts on (the relation will appear on the right side of this node)
  endID: The ID of the node the user believes the relation ends on (the relation will appear on the left side of this node)
  attributes: An object containing all the attributes the relation should have.
    The key is the name of the attribute and the value is its value. Example: {{comment:"Comment"}}
    Both "Link" relations - from one node's view to the other node - will have all of these attributes.
  relation: either "endLink" or "startLink" - the relation to be returned.
  */
  addNodeToView(dataObj, methodObj, methodName, ...args) {
    let attributeString = "";
    for (let attribute in dataObj.attributes) {
      attributeString += `${attribute}: "${dataObj.attributes[attribute]}", `;
    }
    if (attributeString.length > 0) { // if any attributes were found, the string needs to have the last ", " removed,
                                      // and it needs to be enclosed in curly braces.
      attributeString = ` {${attributeString.slice(0, -2)}}`;
    }

    const query = `match (per), (start), (end)
                 where ID(per) = ${app.login.userID} and ID(start) = ${dataObj.startID} and ID(end)=${dataObj.endID}
                 merge (per)-[:Owner]->(view:View {direction:"start"})-[:Subject]->(start)
                 merge (view)-[endLink:Link${attributeString}]->(end)
                 merge (per)-[:Owner]->(view2:View {direction:"end"})-[:Subject]->(end)
                 merge (view2)-[startLink:Link${attributeString}]->(start)
                 return ${dataObj.relation} as link`;
    this.sendQuery(query, methodObj, methodName, ...args);
  }

  /*
  A specific function for metadata queries. The only nodeFunction that DOESN'T need a dataObj JSON object.
  Instead, it just takes an argument called queryName, which is the type of metadata query to run:
  "nodes", "keysNode", "relations", "keysRelation", "myTrash" or "allTrash".
  */
  getMetadata(queryName, methodObj, methodName, ...args) {
    const metadataQueries = {
      nodes: "MATCH (n) unwind labels(n) as L RETURN  distinct L, count(L) as count"
      ,keysNode: "MATCH (p) unwind keys(p) as key RETURN  distinct key, labels(p) as label,  count(key) as count  order by key"
      ,relations: "MATCH (a)-[r]->(b)  return distinct labels(a), type(r), labels(b), count(r) as count  order by type(r)"
      ,keysRelation: "match ()-[r]->() unwind keys(r) as key return distinct key, type(r), count(key) as count"
      ,myTrash: `match (user)-[rel:Trash]->(node) where ID(user)=${app.login.userID} return id(node) as id, node.name as name, labels(node) as labels, rel.reason as reason, node`
      ,allTrash: `match ()-[rel:Trash]->(node) return ID(node) as id, node.name as name, count(rel) as count`
    }

    this.sendQuery(metadataQueries[queryName], methodObj, methodName, ...args);
  }

  // HELPER FUNCTIONS BELOW THIS POINT
  buildSearchString(obj, strings, whereString, defaultName) {
    let string = defaultName;

    if (!(obj.return === false)) { // This should usually be undefined if it's not false, but users might also set it to true
      if (strings.ret == "") {
        strings.ret = `${defaultName}`;
      }
      else strings.ret += `, ${defaultName}`;

      if (obj.name) {
        strings.ret += ` as ${obj.name}`;
      }
    }

    if (obj.type) {
      string += `:${obj.type}`;
    }

    if (obj.properties) {
      let props = "";
      for (let prop in obj.properties) {
        if (props == "") {
          props = `${prop}: "${obj.properties[prop]}"`;
        }
        else props += `, ${prop}: "${obj.properties[prop]}"`;
      }
      string += `{${props}}`;
    }

    if (obj.id && whereString) {
      if (strings[whereString] == "") {
        strings[whereString] = `where ID(${defaultName}) = ${obj.id}`;
      }
      else strings[whereString] += ` and ID(${defaultName}) = ${obj.id}`;
    }

    return string;
  }

  buildChangesString(changeArray) {
    let changes = "";
    for (let i = 0; i < changeArray.length; i++) {
      let value = `"${changeArray[i].value}"`;
      if (changeArray[i].string === false) { // default is that the new value is a string, but can be overridden
        value = `${changeArray[i].value}`;
      }

      if (changes == "") {
        changes = `set ${changeArray[i].item}.${changeArray[i].property} = ${value}`;
      }
      else changes += `, ${changeArray[i].item}.${changeArray[i].property} = ${value}`;
    }
    return changes;
  }

  sendQuery(query, methodObj, methodName, ...args) {
    const xhttp = new XMLHttpRequest();

    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        // Results should be an array of row objects. Each row object will contain one object per item to return.
        // Each of THOSE may contain integer objects with a "high" and "low" value, which should be converted to a simple number.
        // identity variables, specifically, should be rewritten as "id" for ease of typing later.
        // Also, row objects from metadata queries may include an id or count variable, which should also be rewritten.
        const result = JSON.parse(this.responseText);
        for (let i = 0; i < result.length; i++) {
          const row = result[i];
          if (row.count) {
            row.count = row.count.low;
          }
          if (row.id) {
            row.id = row.id.low;
          }

          for (let item in row) {
            const entry = row[item];
            if (entry && entry.identity && entry.identity.low) {
              const IDobj = entry.identity;
              const ID = IDobj.low;
              entry.id = ID;
              delete entry.identity;
            }
            if (entry && entry.properties && entry.properties.count && entry.properties.count.low) {
              entry.properties.count = entry.properties.count.low;
            }

            if (entry && entry.properties) {
              for (let property in entry.properties) {
                // This is the best set of criteria I can see to recognize an Integer object without using Neo4j functions:
                // It has exactly two own properties (high and low), "high" is 0 and "low" is an integer.
                const value = entry.properties[property];
                if (typeof value === "object" && Object.keys(value).length == 2
                    && "low" in value && Number.isInteger(value.low) && "high" in value && value.high === 0) {
                  entry.properties[property] = value.low;
                } // end if (value is a Neo4j integer)
              } // end for (every property in the item)
            } // end if (the item has properties)
          } // end for (every item in the row)
        } // end for (every row)
        // send results to desired function
        if (methodObj && methodName) {
          methodObj[methodName](result, ...args);
        }
      }
    };

    xhttp.open("POST","");
    const queryObject = {"server": "neo4j", "query": query};
    xhttp.send(JSON.stringify(queryObject));         // send request to server
  }
}
