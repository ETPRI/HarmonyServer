// This class is used to check whether the DB is empty before running tests that require an empty DB.
class checkEmpty {
  constructor() {}

  // Runs a query to see all nodes in the database, then passes the results to verifyEmpty.
  checkEmpty() {
    const obj = {};
    obj.node = {};

    app.sendQuery(obj, "changeNode", "Looking for nodes", null, this.verifyEmpty.bind(this));

    // const queryObject = {"server": "CRUD", "function": "changeNode", "query": obj, "GUID": app.login.userGUID};
    // const request = JSON.stringify(queryObject);
    //
    // const xhttp = new XMLHttpRequest();
    // const check = this;
    // const update = app.startProgress(null, "Looking for nodes", request.length);
    //
    // xhttp.onreadystatechange = function() {
    //   if (this.readyState == 4 && this.status == 200) {
    //     const data = JSON.parse(this.responseText);
    //     app.stopProgress(null, update, this.responseText.length);
    //     check.verifyEmpty(data);
    //   }
    // };
    //
    // xhttp.open("POST","");
    // xhttp.send(request);         // send request to server
  }

  // Checks whether any nodes were found. If so, alert the user that an empty database is needed,
  // and reset all regression variables (turn off recording and replay, remove uploaded files, etc.).
  verifyEmpty(data) {
    if (data.length > 0) { // If any data were returned
      alert ("This test can only be run on an empty database! Please switch to an empty database and try again. This recording will be aborted.");
      app.regression.recordToggle(document.getElementById("Record"));
      app.regression.playing = false;
      app.regression.stepThrough = false;
      app.regression.fileRunning = false;
      app.regression.playbackObj = {};
      app.regression.playFiles = 0;
      app.regression.instruction = 1;
      const fileButton = document.getElementById("playback");
      fileButton.value="";
    }
    // log
    const obj = {};
    obj.id = "checkEmpty";
    obj.action = "click";
    obj.data = data; // No real need to strip the IDs - I was doing that to make recordings and replays match, but if this gets triggered that ship has sailed.
    app.regression.log(JSON.stringify(obj));
    app.regression.record(obj);
  }
}
