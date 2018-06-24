// This class is used to check whether the DB is empty before running tests that require an empty DB.
class checkEmpty {
  constructor() {}

  // Runs a query to see all nodes in the database, then passes the results to verifyEmpty.
  checkEmpty(button) {
    const obj = {};
    obj.node = {};
    obj.node.name = "n";
    app.nodeFunctions.changeNode(obj, this, 'verifyEmpty');
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
