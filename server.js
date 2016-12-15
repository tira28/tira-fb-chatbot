var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var cfenv = require("cfenv");
var appEnv = cfenv.getAppEnv();
var port = appEnv.port;
var helmet = require('helmet');

// use helmet
app.use(helmet());

// setting body parser
app.use(bodyParser.json());

// setting port
app.set('port', port);

// setting view engine to ejs
app.set('view engine', 'ejs');

// setting index page
app.get('/', function(req,res){
    res.render('pages/index');
});

// calling app module
require('./app')(app);

app.listen(port, function() {
    console.log('Client server listening on port ' + port);
});





