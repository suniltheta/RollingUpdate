/**
 * Created by Sunil on 4/17/2017.
 */
var redis = require('redis')
var multer  = require('multer')
var express = require('express')
var fs      = require('fs')
var http = require('http')
var httpProxy = require('http-proxy')
var app = express()
var proxy = httpProxy.createProxyServer({});
var workerPort = 3000
// REDIS
var client = redis.createClient(6379, '127.0.0.1', {})
var servers = {};

///////////// WEB ROUTES

// Add hook to make it easier to get all visited URLS.
app.use(function(req, res, next)
{
    console.log(req.method, req.url);

    app.get('/', function(req, res) {
        client.scard("workers", function(err, count){
            console.log("Number of active containers: "+ count)
            if(count > 0){
                client.rpoplpush("workers", "workers", function (err, value) {
                    console.log(value)
                    proxy.web(req, res, {
                        //value = "http://localhost:" + value;
                        target: value
                    })
                })
            }
            else{
                res.send("Just proxy here, No containers to route to");//TODO: give description on how to spin up new containers
            }
        })
        res.send('hello world');
    });
    next(); // Passing the request to the next handler in the stack.
});

app.get('/spawn',function(req, res){
    console.log("***********************************************************************************")
    console.log("Spawn of new containers called. Now going to run Shell script to spin up containers")
    console.log("***********************************************************************************")
    workerPort += 1
    exec("sh new_worker.sh " + workerPort,
    function (out, stdout, stdout) {
        console.log(out)
        console.log(stdout)
        console.log(err)
        if(err) throw err;
        client.add("workers", "http://54.191.196.11"+ workerPort);
    })
    // client.llen("servers", function(err, noOfServers){
    //     if(noOfServers == 0){
    //         createNewServer(3000, res);
    //     }
    //     else{
    //         getUnusedPort(noOfServers, res, createNewServer);
    //     }
    // });
});

app.get('/destroy',function(req, res){
    client.spop("workers", function (err, ip_port) {
        exec("kill -9 $(lsof -t -i:" + ip_port + ")")
        res.send("destroyed container at: "+ ip_port)
        console.log("destroyed container at: "+ ip_port)
        workerPort--;
    })
    // client.llen("servers", function (err, noOfServers) {
    //     if(noOfServers > 2){
    //         client.lrange("servers", 0, -1, function (err, listOfServers) {
    //             var index = Math.floor(Math.random() * (noOfServers));
    //             var port = listOfServers[index];
    //
    //             var someServer = servers[port];
    //             someServer.close();
    //             console.log('Server closed at port %s',port);
    //             res.send("Server destroyed, listening at port : " + port);
    //             client.lrem("servers", 1, port);
    //         });
    //     }
    // });
});




// app.post('/upload',[ multer({ dest: './uploads/'}), function(req, res){
//     //console.log(req.body) // form fields
//     //console.log(req.files) // form files
//
//     if( req.files.image )
//     {
//         fs.readFile( req.files.image.path, function (err, data) {
//             if (err) throw err;
//             var img = new Buffer(data).toString('base64');
//             //console.log(img);
//             client.rpush("img", img);
//         });
//     }
//     res.status(204).end()
// }]);
//
// app.get('/meow', function(req, res) {
//     client.lpop("img", function(err, imagedata){
//         if (err) throw err;
//         res.writeHead(200, {'content-type':'text/html'});
//         res.write("<h1>\n<img src='data:my_pic.jpg;base64,"+imagedata+"'/>");
//         res.end();
//     });
// });


app.get('/get', function (req, res) {
    client.get("key", function(err, value){
        res.send(value);
    });
});

app.get('/set', function (req, res) {
    client.set("key", "this message will self-destruct in 10 seconds");
    client.expire("key", 10);
    res.send("Self destroying message set");
});

app.get('/recent', function (req, res) {
    client.lrange("recent_url", 0, 4, function(err, reply) {
        res.send(reply);
    });
});



var getUnusedPort = function (noOfServers,res, callback) {
    client.lrange("servers", 0, -1, function (err, listOfServers) {
        client.lrange("servers", 0, -1, function (err, portList) {
            getMaxMinPort(portList, function (max, min) {
                for (var i = 3000; i < max - min + 3000; i++) {
                    if(listOfServers.indexOf(i.toString()) < 0){
                        callback(i, res);
                        return;
                    }
                }
                callback(i + 1, res);
            });
        });
    });
};

var getMaxMinPort = function (portList, callback) {
    var max = portList[0];
    var min = portList[0];
    for (var i = 0; i < portList.length; i++){
        if(portList[i] > max){
            max = portList[i];
        }
        if(portList[i] < min){
            min = portList[i];
        }
    }
    callback(max, min);
};

var createNewServer = function (port, res) {
    var server = app.listen(port, function () {
        var host = server.address().address;
        var port = server.address().port;
        console.log('Example app listening at http://%s:%s', host, port);
        res.send("New server created, listening at port : " + port);
        client.lpush("servers", port);
        servers[port] = server;
    });
};

// app.get('/destroy',function(req, res){
//     client.llen("servers", function (err, noOfServers) {
//         if(noOfServers > 2){
//             client.lrange("servers", 0, -1, function (err, listOfServers) {
//                 var index = Math.floor(Math.random() * (noOfServers));
//                 var port = listOfServers[index];
//
//                 var someServer = servers[port];
//                 someServer.close();
//                 console.log('Server closed at port %s',port);
//                 res.send("Server destroyed, listening at port : " + port);
//                 client.lrem("servers", 1, port);
//             });
//         }
//     });
// });

app.get('/listservers',function(req, res){
    client.lrange("servers", 0, -1, function(err, reply) {
        res.send(reply);
    });
});

// HTTP SERVER
var server = app.listen(3000, function () {

    var host = server.address().address;
    var port = server.address().port;

    console.log('Example app listening at http://%s:%s', host, port);
    client.del("servers", function(err, reply){});
    client.lpush("servers", port);
    servers[port] = server;
});

///////////// WEB ROUTES

// http.createServer(function (req, res) {
//     client.llen("servers", function (err, noOfServers) {
//         if(noOfServers == 0){
//             var result = "http://localhost:3000/spawn";
//
//             var proxy = httpProxy.createProxyServer({target: result});
//             proxy.web(req, res);
//             console.log(result +req.url);
//         }
//         else{
//             client.rpoplpush("servers", "servers", function (err, value) {
//                 var result = "http://localhost:" + value;
//                 var proxy = httpProxy.createProxyServer({target: result});
//                 proxy.web(req, res);
//                 console.log(result +req.url);
//             });
//         }
//     });
//
//
// }).listen(9000);
//console.log("listening on port: 9000");

