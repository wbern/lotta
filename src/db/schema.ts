import type { Database } from 'sql.js'

const SCHEMA_SQL = `
CREATE TABLE clubs (
  "index" INTEGER PRIMARY KEY AUTOINCREMENT,
  club TEXT NOT NULL UNIQUE,
  chess4members INTEGER
);

CREATE TABLE availableplayers (
  "index" INTEGER PRIMARY KEY AUTOINCREMENT,
  lastname TEXT NOT NULL,
  firstname TEXT,
  ssfid INTEGER,
  clubindex INTEGER,
  ratingn INTEGER,
  ratingi INTEGER,
  ratingq INTEGER,
  ratingb INTEGER,
  ratingk INTEGER,
  ratingkq INTEGER,
  ratingkb INTEGER,
  title TEXT,
  sex TEXT,
  federation TEXT,
  fideid INTEGER,
  birthdate TEXT,
  playergroup TEXT,
  FOREIGN KEY (clubindex) REFERENCES clubs("index")
);

CREATE UNIQUE INDEX availableplayers_idx
  ON availableplayers (lastname, firstname, clubindex);

CREATE TABLE tournaments (
  "index" INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament TEXT NOT NULL,
  tournamentgroup TEXT NOT NULL,
  pairingsystem TEXT NOT NULL,
  initialpairing TEXT NOT NULL,
  rounds INTEGER NOT NULL,
  barredpairing TEXT NOT NULL,
  compensateweakplayerpp TEXT NOT NULL,
  chess4 TEXT NOT NULL,
  pointspergame INTEGER NOT NULL,
  resultspage TEXT,
  standingspage TEXT,
  playerlistpage TEXT,
  roundforroundpage TEXT,
  clubstandingspage TEXT,
  ratingchoice TEXT NOT NULL,
  showlask TEXT,
  showelo TEXT,
  showgroup TEXT,
  city TEXT,
  startdate TEXT,
  enddate TEXT,
  chiefarbiter TEXT,
  deputyarbiter TEXT,
  timecontrol TEXT,
  federation TEXT
);

CREATE UNIQUE INDEX tournaments_idx
  ON tournaments (tournament, tournamentgroup);

CREATE TABLE tournamentplayers (
  "index" INTEGER PRIMARY KEY AUTOINCREMENT,
  lastname TEXT NOT NULL,
  firstname TEXT,
  ssfid INTEGER,
  clubindex INTEGER,
  ratingn INTEGER,
  ratingi INTEGER,
  ratingq INTEGER,
  ratingb INTEGER,
  ratingk INTEGER,
  ratingkq INTEGER,
  ratingkb INTEGER,
  title TEXT,
  playergroup TEXT,
  sex TEXT,
  federation TEXT,
  fideid INTEGER,
  birthdate TEXT,
  tournamentindex INTEGER NOT NULL,
  withdrawnfromround INTEGER,
  manualtiebreak INTEGER,
  FOREIGN KEY (tournamentindex) REFERENCES tournaments("index"),
  FOREIGN KEY (clubindex) REFERENCES clubs("index")
);

CREATE UNIQUE INDEX tournamentplayers_idx
  ON tournamentplayers (lastname, firstname, clubindex, tournamentindex);

CREATE TABLE tournamentgames (
  tournament INTEGER NOT NULL,
  round INTEGER NOT NULL,
  boardnr INTEGER NOT NULL,
  whiteplayer INTEGER,
  blackplayer INTEGER,
  resulttype INTEGER NOT NULL,
  whitescore REAL NOT NULL,
  blackscore REAL NOT NULL,
  whiteplayerlotnr INTEGER,
  blackplayerlotnr INTEGER,
  PRIMARY KEY (tournament, round, boardnr),
  FOREIGN KEY (tournament) REFERENCES tournaments("index"),
  FOREIGN KEY (whiteplayer) REFERENCES tournamentplayers("index"),
  FOREIGN KEY (blackplayer) REFERENCES tournamentplayers("index")
);

CREATE TABLE tournamentrounddates (
  tournament INTEGER NOT NULL,
  round INTEGER NOT NULL,
  rounddate TEXT,
  PRIMARY KEY (tournament, round),
  FOREIGN KEY (tournament) REFERENCES tournaments("index")
);

CREATE TABLE tournamenttiebreaks (
  "index" INTEGER PRIMARY KEY AUTOINCREMENT,
  tiebreak TEXT NOT NULL,
  tournamentindex INTEGER NOT NULL,
  UNIQUE (tiebreak, tournamentindex),
  FOREIGN KEY (tournamentindex) REFERENCES tournaments("index")
);

CREATE TABLE settings (
  setting TEXT NOT NULL PRIMARY KEY,
  value INTEGER
);

CREATE TABLE stringsettings (
  setting TEXT NOT NULL PRIMARY KEY,
  value TEXT
);
`

export function createSchema(db: Database): void {
  db.run(SCHEMA_SQL)
}
