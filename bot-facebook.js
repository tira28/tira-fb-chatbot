/**
 * Created by yudistira on 12/8/16.
 */

var dotenv = require('dotenv');
var Botkit = require('botkit');
var winston = require('winston');
var axios = require('axios');
var Yelp = require('yelpv3');


var controller = Botkit.facebookbot({
    access_token: process.env.FB_ACCESS_TOKEN,
    verify_token: process.env.FB_VERIFY_TOKEN
});

var bot = controller.spawn();
controller.hears('(.*)', 'message_received', function(bot,message){

    var watsonMessage = message.watsonData;
    var intent = watsonMessage.intents[0].intent;
    var context = watsonMessage.context;
    var input = watsonMessage.input;
    var output = watsonMessage.output;

    winston.level='debug';

    if (watsonMessage.intents.length > 0 && watsonMessage.intents[0].intent === 'get_weather') {

        winston.info('Calling geolocation API');


        // Important context and variables
        var city = context.city;
        const GOOGLE_API = process.env.GOOGLE_API_KEY;
        var url_geolocation = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + city + '&key=' + GOOGLE_API;


        // Calling geolocation API
        axios.get(url_geolocation).then(function(response){

            var location = {
                lat: response.data.results[0].geometry.location.lat,
                lng: response.data.results[0].geometry.location.lng
            };

            console.log('lat:', location.lat.toFixed(2));
            console.log('lng', location.lng.toFixed(2));

            // Dark sky API
            const DARK_SKY_API = process.env.DARKSKY_API_KEY;
            var url_weather = 'https://api.darksky.net/forecast/' + DARK_SKY_API + '/' + location.lat + ',' + location.lng;


            // The weather company API
            // The Weather Company Credentials and URL
            /*const WEATHER_COMPANY_USER = process.env.WEATHER_COMPANY_USERNAME;
             const WEATHER_COMPANY_PASS = process.env.WEATHER_COMPANY_PASSWORD;
             const WEATHER_COMPANY_PORT = process.env.WEATHER_COMPANY_PORT;

             var url_weather_company = `https://${WEATHER_COMPANY_USER}:${WEATHER_COMPANY_PASS}@twcservice.eu-gb.mybluemix.net:${WEATHER_COMPANY_PORT}/api/weather` + `/v1/geocode/${location.lat}/${location.lng}/forecast/daily/3day.json`;
             */

            return axios.get(url_weather);

        }).then(function(response){

            winston.info('Calling weather API');

            /*console.log(response.data.forecasts[0].day.temp);
             console.log(response.data.forecasts[0].day.shortcast);*/

            // Results from dark weather API
            var summary = response.data.currently.summary;
            var apparentTemperature = response.data.currently.apparentTemperature;

            // From the Weather Company
            /*var summary = response.data.forecasts[0].day.shortcast;
             var apparentTemperature = response.data.forecasts[0].day.temp;*/

            output.text = summary + ' in ' + city + ' with temperature ' + (apparentTemperature - 32).toFixed(0) + ' C';

        }).then(function(){
            console.log(output.text);
            return bot.reply(message, output.text);
        }).catch(function(error){
            console.log(error);
        });

    } else if (watsonMessage.intents.length > 0 && watsonMessage.intents[0].intent === 'get_landmarks'){

        winston.info('Calling landmark API');

        // Important context and variables
        var city = context.city;
        var landmarks = context.landmarks;
        console.log('city', city);

        // Credentials for Yelp module
        var yelp = new Yelp({
            app_id: process.env.YELP_APP_ID,
            app_secret: process.env.YELP_APP_SECRET
        });

        // Calling Yelp API
        yelp.search({
            term:'sightseeing',
            location:city,
            limit:5
        }).then(function(data){
            landmarks = [];
            var places = JSON.parse(data);

            for (var i = 0; i<places.businesses.length; i++) {
                var businessName = places.businesses[i].name;
                landmarks.push(businessName);
            }
            console.log('landmarks:',landmarks);
            output.text = 'In ' + city + ', I\'d like to recommend you to go to: ' + landmarks;
            console.log(output.text);
        }).then(function(){
            return bot.reply(message, output.text);
        }).catch(function(err){
            console.log(err);
        });
    } else if (watsonMessage.intents.length > 0 && watsonMessage.intents[0].intent === 'book_ticket' && watsonMessage.context.remarks === "Results") {

        // Check whether important data has been loaded
        var travelData = watsonMessage;
        var originAirport = watsonMessage.context.origin_airport;
        var destinationAirport = watsonMessage.context.destination_airport;
        var departureDate = watsonMessage.context.departure_date;
        var returnDate = watsonMessage.context.return_date;
        var originDepartingTime = watsonMessage.context.origin_departing_time;
        var returningDepartingTime = watsonMessage.context.returning_departing_time;

        winston.info('Origin: ', originAirport);
        winston.info('Destination: ', destinationAirport);
        winston.info('Departure Date: ', departureDate);
        winston.info('Return Date: ', returnDate);
        winston.info('Origin Departing Time: ', originDepartingTime);
        winston.info('Returning Departing Time: ', returningDepartingTime);
        winston.info('Output Text: ', output.text);

        // Define flight query
        var flightQuery;
        flightQuery = {
            "request": {
                "passengers": {"adultCount": 1},
                "slice": [
                    {
                        "origin": `${originAirport}`,
                        "destination": `${destinationAirport}`,
                        "date": `${departureDate}`,
                        "permittedCarrier": ['KL'],
                        "maxStops": 0,
                        "permittedDepartureTime" : {
                            "kind": "qpxexpress#timeOfDayRange",
                            "earliestTime":`${originDepartingTime}`,
                            "latestTime": '23:59'
                        },
                        "solutions": 1
                    },
                    {
                        "origin": `${destinationAirport}`,
                        "destination": `${originAirport}`,
                        "date": `${returnDate}`,
                        "permittedCarrier": ['KL'],
                        "maxStops": 0,
                        "permittedDepartureTime" : {
                            "kind": "qpxexpress#timeOfDayRange",
                            "earliestTime":`${returningDepartingTime}`,
                            "latestTime": '23:59'
                        },
                        "solutions": 1
                    },
                ]
            }
        };

        const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
        var url_qpx = `https://www.googleapis.com/qpxExpress/v1/trips/search?key=${GOOGLE_API_KEY}`;

        // Calling Google QPX API
        axios.post(url_qpx,flightQuery).then(function(response){

            winston.info('Calling Google QPX Express API');

            var trips = response.data.trips;
            var tripOption = trips.tripOption[0];

            var summary = {
                departure_date: flightQuery.request.slice[0].date,
                return_date: flightQuery.request.slice[1].date,
                origin_airport_code: trips.data.airport[0].code,
                origin_airport_name: trips.data.airport[0].name,
                origin_city_name: trips.data.city[0].name,
                destination_airport_code: trips.data.airport[1].code,
                destination_airport_name: trips.data.airport[1].name,
                destination_city_name:trips.data.city[1].name,
                carrier: trips.data.carrier[0].name,
                departing_flight_code: tripOption.slice[0].segment[0].flight.carrier,
                departing_flight_number: tripOption.slice[0].segment[0].flight.number,
                returning_flight_code: tripOption.slice[1].segment[0].flight.carrier,
                returning_flight_number: tripOption.slice[1].segment[0].flight.number,
                travel_fare: tripOption.saleTotal
            };

            var flyingTime = {
                departing_flight_departure_time: tripOption.slice[0].segment[0].leg[0].departureTime,
                departing_flight_arrival_time: tripOption.slice[0].segment[0].leg[0].arrivalTime,
                returning_flight_departure_time: tripOption.slice[1].segment[0].leg[0].departureTime,
                returning_flight_arrival_time: tripOption.slice[1].segment[0].leg[0].arrivalTime
            };

            var departingDepartureTimeHour =  new Date(flyingTime.departing_flight_departure_time).getHours();
            var departingDepartureTimeMinutes =  new Date(flyingTime.departing_flight_departure_time).getMinutes();
            var departingDepartureTime = departingDepartureTimeHour + ':' + departingDepartureTimeMinutes;

            var departingArrivalTimeHour = new Date(flyingTime.departing_flight_arrival_time).getHours();
            var departingArrivalTimeMinutes = new Date(flyingTime.departing_flight_arrival_time).getMinutes();
            var departingArrivalTime = departingArrivalTimeHour + ':' + departingArrivalTimeMinutes;

            var returningDepartureTimeHour = new Date(flyingTime.returning_flight_departure_time).getHours();
            var returningDepartureTimeMinutes = new Date(flyingTime.returning_flight_departure_time).getMinutes();
            var returningDepartureTime = returningDepartureTimeHour + ':' + returningDepartureTimeMinutes;

            var returningArrivalTimeHour = new Date(flyingTime.returning_flight_arrival_time).getHours();
            var returningArrivalTimeMinutes = new Date(flyingTime.returning_flight_arrival_time).getHours();
            var returningArrivalTime = returningArrivalTimeHour + ':' + returningArrivalTimeMinutes;

            output.text = ['Thank you for flying with KLM Royal Dutch Airlines\n',
            'Here is your flight details: \n',
                'Your departing flight code is: ' + summary.departing_flight_code + summary.departing_flight_number + '\n',
                'Earliest possible departing time: ' + departingDepartureTime + '\n',
                'Arrival time: ' + departingArrivalTime + '\n',
                'Your returning flight code is: ' + summary.returning_flight_code + summary.returning_flight_number + '\n',
                'Earliest possible departing time: ' + returningDepartureTime + '\n',
                'Arrival time: ' + returningArrivalTime + '\n',
                'Fare: ' + summary.travel_fare + '\n',
                'This service is powered by IBM Watson and Google QPX Flight Service\n'
            ];

            winston.info(output.text);

            if (Array.isArray(output.text)) {
                return bot.reply(message, output.text.join('\n'));
            } else {
                return bot.reply(message, output.text);
            }

        }).catch(function(error){
            console.log(error);
            console.log('There\'s no flight service with KLM on the proposed schedule.');
            output.text = ['I\'m apologise, there\'s no flight service with KLM on the proposed schedule.\n'];
            return bot.reply(message, output.text.join('\n'));
        });

    } else {

        output.text;
        console.log('Output Text:',output.text);


        // Check whether the output is array
        if (Array.isArray(output.text)) {
            return bot.reply(message, output.text.join('\n'));
        } else {
            return bot.reply(message, output.text);
        };
    }

});

module.exports = {
    controller:controller,
    bot: bot
};





