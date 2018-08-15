/*
Stores information about the types of nodes that are included in the database.
Eventually, we want to move this information to the database and enable the user to customize it.
The only thing I don't think we should let them do is delete the "person" type, because
if there are no people there can be no users or admins, so no one would be able to log in.
*/

class metaData {
//  calls initNodeData and initRelationData to build the node and relation objects.
constructor () {
  this.node     = {};  this.initNodeData();
  this.relation = {};  this.initRelationData();
}

// returns the object associated with the name that was passed in. This object describes a type of relation.
getRelation(name){
  return(this.relation[name]);
}

// returns the object associated with the name that was passed in. This object describes a type of node.
getNode(name){
  return(this.node[name]);
}

// Initializes the objects representing different types of relations. So far there's only one, called "link".
// All objects are stored as key/value pairs in this.relation. The objects include a label for the type of link,
// and a list of fields which should be stored for this type of link with their labels.
initRelationData(){
  this.relation.link = {
     nodeLabel: "link"
    ,fields: {
    	"comment":   {label: "Comment"}
    }}

}  /////// end method

// Initializes the objects representing various types of nodes. All objects are stored as key/value pairs in this.node.
// The objects include a label for the type of node, an ordering for which fields to sort nodes by first, a list of
// fields to display in widgetTableNodes, and a list of ALL fields, including ones only shown in a widgetNode widget,
// along with labels to refer to them by. Some fields also have an "att": an attribute to add to that field in the table.
initNodeData() { // move to DB in the future
  ///////////////////////////////////// ETPRI
  this.node.people = {
     nodeLabel: "people"
    ,orderBy: "n.name, n.nameLast, n.nameFirst, n.email"
    ,fieldsDisplayed: ["name","nameLast", "nameFirst", "email"]
    ,fields: {
      // I'm not sure this att is needed. It refers to a method that doesn't exist and that I don't think we plan to implement.
     "name":       {label: "Name" , att: `onclick="app.widget('relationAdd',this)"` }
    ,"nameLast":   {label: "Last Name" }
    ,"nameFirst":  {label: "First Name"}
    ,"email":      {label: "Email"     }
    ,"state":      {label: "State"     }
    ,"comment":    {label: "Comment"   }
    }}

  this.node.organization = {
     nodeLabel: "organization"
    ,orderBy: "n.name, n.web"
    ,fieldsDisplayed: ["name", "web"]
    ,fields: {"name":       {label: "Name" }
      ,"web":      {label: "Web"}
      ,"comment":  {label: "Comment"  }
    }}

  this.node.topic = {
     nodeLabel: "topic"
    ,orderBy: "n.name, n.comment"
    ,fieldsDisplayed: ["name", "comment"]
    ,fields: {"name":       {label: "Name" }
      ,"comment":    {label: "Comment"}
    }}


  this.node.address = {
    nodeLabel: "address"
    ,orderBy: "n.name, n.state, n.postalCode, n.city, n.street1, n.street2"
    ,fieldsDisplayed: ["name", "street1", "street2", "city", "state", "postalCode"]
    ,fields: {"name":       {label: "Name"}
    ,"street1":    {label: "Street"}
    ,"street2":    {label: ""  }
    ,"city":       {label: "City"  }
    ,"state":      {label: "State"  }
    ,"postalCode": {label: "Zip"  }
    ,"country":    {label: "Country"  }
    ,"comment":    {label: "Comment"  }
    }}

  this.node.mindmap = {
    nodeLabel: "mindmap"
    ,orderBy: "n.name" // , n.lastEdited, n.created, n.lastEditor, n.creator
    ,fieldsDisplayed: ["name", "comment"] // , "creator", "created", "lastEditor", "lastEdited"
    ,fields: {
      "name":         {label: "Name"}
      ,"comment":     {label: "Comment"}
      // ,"creator":     {label: "Created by"}  // Add this stuff later - have to research how to search by a date
      // ,"created":     {label: "Created on", type: "date"}
      // ,"lastEditor":  {label: "Last edited by"}
      // ,"lastEdited":  {label: "Last edited on", type: "date"}
    }}

    this.node.calendar = {
      nodeLabel: "calendar"
      ,orderBy: "n.name, n.description"
      ,fieldsDisplayed: ["name", "description"]
      ,fields: {
        "name": {label: "Name"}
        ,"description": {label: "Description"}
        // Add more here later - probably search criteria (each calendar is like a different search for events)
      }
    }

 // I was using these for testing (obviously) but I think I'll comment them out for now.
 // Will delete them when I'm sure we aren't testing anymore.
  // this.node.Test = {
  //   nodeLabel: "Test"
  //   ,orderBy: "n.name, n.field1, n.field2, n.field3"
  //   ,fieldsDisplayed: ["field1", "field2", "field3"]
  //   ,fields: {
  //     "name":     {label: "Name"}
  //     ,"field1":  {label: "First"}
  //     ,"field2":  {label: "Second"}
  //     ,"field3":  {label: "Third"}
  //   }
  // }
  //
  // this.node.Test2 = {
  //   nodeLabel: "Test2"
  //   ,orderBy: "n.name, n.field1, n.field2, n.field3"
  //   ,fieldsDisplayed: ["field1", "field2", "field3"]
  //   ,fields: {
  //     "name":     {label: "Name"}
  //     ,"field1":  {label: "First"}
  //     ,"field2":  {label: "Second"}
  //     ,"field3":  {label: "Third"}
  //   }
  // }

} ////// end method

} ////////////////////////////////////////////////////// end class
