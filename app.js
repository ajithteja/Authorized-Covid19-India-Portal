const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let app = express();
app.use(express.json());
let dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;
let initializingDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  }
};

initializingDbAndServer();

let authentication = async (request, response, next) => {
  let authenticationToken = request.headers["authorization"];
  let userToken;
  if (authenticationToken !== undefined) {
    userToken = authenticationToken.split(" ")[1];
  }
  if (userToken !== undefined) {
    await jwt.verify(userToken, "secrete_key", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

// API 2 list of states

app.get("/states/", authentication, async (request, response) => {
  let allStatesQuery = `SELECT * FROM state;`;
  let allStatesArr = await db.all(allStatesQuery);
  let funcsnakeCaseToCamalCase = (eachObj) => {
    return {
      stateId: eachObj.state_id,
      stateName: eachObj.state_name,
      population: eachObj.population,
    };
  };
  let newArr = [];
  for (let eachObj of allStatesArr) {
    let newObj = funcsnakeCaseToCamalCase(eachObj);
    newArr.push(newObj);
  }
  response.send(newArr);
});

// API 3

app.get("/states/:stateId/", authentication, async (request, response) => {
  let { stateId } = request.params;
  let stateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  let stateObj = await db.get(stateQuery);
  response.send({
    stateId: stateObj.state_id,
    stateName: stateObj.state_name,
    population: stateObj.population,
  });
});

// API 4 districts

app.post("/districts/", authentication, async (request, response) => {
  let { districtName, stateId, cases, cured, active, deaths } = request.body;
  let insertDistrictQuery = `INSERT INTO district 
    (district_name, 
        state_id, cases, 
        cured, active, 
        deaths)
        VALUES 
        ('${districtName}', 
        '${stateId}', 
        '${cases}', 
        '${cured}',
        '${active}', 
        '${deaths}');
        `;
  await db.run(insertDistrictQuery);
  response.send("District Successfully Added");
});

// API 5

app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    let getDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
    let districtObj = await db.get(getDistrictQuery);
    let funcObjectCase = (oldObj) => {
      return {
        districtId: oldObj.district_id,
        districtName: oldObj.district_name,
        stateId: oldObj.state_id,
        cases: oldObj.cases,
        cured: oldObj.cured,
        active: oldObj.active,
        deaths: oldObj.deaths,
      };
    };
    if (districtObj !== undefined) {
      let newObj = funcObjectCase(districtObj);
      response.send(newObj);
    } else {
      response.send("No data");
    }
  }
);

// API 6

app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    let { districtId } = request.params;
    let districtDeleteQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
    await db.run(districtDeleteQuery);
    response.send("District Removed");
  }
);

// API 7

app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    let { districtId } = request.params;
    let { districtName, stateId, cases, cured, active, deaths } = request.body;

    let updateQuery = `UPDATE district
    SET district_name = '${districtName}',
        state_id = '${stateId}',
        cases = '${cases}',
        cured = '${cured}',
        active = '${active}',
        deaths = '${deaths}'
    WHERE
        district_id = ${districtId};`;
    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

// API 8

app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = await request.params;

    let statsQuery = await `SELECT SUM(cases) AS totalCases,
   SUM(cured) AS totalCured,
   SUM(active) AS totalActive,
   SUM(deaths) AS totalDeaths
    FROM district
    WHERE state_id = ${stateId};`;

    // console.log(statsQuery);
    let newArr = await db.get(statsQuery);
    // console.log(newArr);
    response.send(newArr);
  }
);

// API 1 Login

app.post("/login/", async (request, response) => {
  let userData = request.body;
  const { username, password } = userData;
  let hasUserExistQuery = `SELECT * 
  FROM user 
  WHERE username = '${username}';`;
  let userDetails = await db.get(hasUserExistQuery);
  if (userDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    let hasPasswordCorrect = await bcrypt.compare(
      password,
      userDetails.password
    );
    if (hasPasswordCorrect === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      let payload = {
        username: username,
      };
      let userToken = await jwt.sign(payload, "secrete_key");
      response.send({ jwtToken: userToken });
    }
  }
});

module.exports = app;
