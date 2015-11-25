var mysql = require('mysql');
var express = require('express');
var https = require('https');
var mailer = require("nodemailer");
var emaile   = require("emailjs/email");
var fs = require('fs');
var qs = require('querystring');

var app = express();

var appName = "ocioboxs";
var response = new Object();

var connection = mysql.createConnection({

  host     : 'ocioboxsdb.cjwaeuuatgpw.us-west-2.rds.amazonaws.com',
  user     : 'root',
  password : 'amli4248',
  database : 'ocioboxsdb',
});

// var connection = mysql.createConnection(
//     {
//       host     : 'localhost',
//       user     : 'root',
//       password : '',
//       database : 'ocioboxsdb',
//     }
// );

app.get('/', function(req, res) {
  res.type('application/json');
  res.json({serverReply: "Server Started"});
});


//---------------------------------------------
// 1 - Access Fb Data of specific email 
// E1 - IMPORTANT RESCALE THE SIZE OF THE IMAGE.
// E2 - REMEMBER THE 4 CASES FOR FB ON THE REGISTRATION OR LOGIN 
// (1-ACCESS THROUGH FB FIRST TIME, 2-ACCESS THROUGH FB ONCE THE GUY IS REGISTRED THROUGH MAIL (UPDATE USER DATA), 
// 3- ACCESS THROUGH FB ONCE SOMEONE REGISTRED HIM THROUGH MAIL (UPDATE USER DATA), 
// 4- ACCESS THROUGH FB ONCE SOMEONE REGISTRED HIM THROUGH FB (BECAREFUL HERE BECAUSE WE WILL NEED TO CHECK THE FB_ID AND UPDATE THE INFO))

// Image WILL BE IN base64String. IMAGE will be RESCALED ON mobile app

//---------------------------------------------
//In this webservice,Communicate to database "user_profile" and it will return a json result containing user id. 
//In case of any error it response with error. 

app.post('/access_fb', function(request, res) {
  res.type('application/json');
  response = new Object();

  if (request.method == 'POST') {
        var body = '';
        request.on('data', function (data) {
            body += data;
            // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
            if (body.length > 1e6) { 
                // FLOOD ATTACK OR FAULTY CLIENT, NUKE REQUEST
                request.connection.destroy();

                //res.json({application:appName,success:"false",message:"ServerError",data:response});
            }
        });
        request.on('end', function () {

            var POST = qs.parse(body);

            var mail = POST.mail;
            var fb_id = POST.fb_id;
            var name = POST.name;
            var sex = POST.sex;
            var image = POST.image;
            var age = POST.age;


            queryString = "INSERT INTO user_profile SET mail='"+mail+"',pass='fb',name='"+name+"',sex='"+sex+"',image='"+image+"',age='"+age+"', fb_id='"+fb_id+"', validated=1";

              connection.query(queryString, function(err,data) {
                if(err)
                {
                  console.log(mail);
                  if (err.code == "ER_DUP_ENTRY")
                  {
                    console.log(mail+"1");
                    // IF USER ALREADY EXIST I JUST HAVE TO CHECK WITH THE EMAIL AND UPDATE THE DATA
                    queryString = "UPDATE user_profile SET name='"+name+"',sex='"+sex+"',image='"+image+"',age='"+age+"', validated=1 WHERE fb_id='"+fb_id+"'";

                    connection.query(queryString, function(err,data) {
                      if (err)
                      {
                        console.log(mail+"2");
                        res.json({application:appName,success:"false",message:"ServerError",data:response});
                        return;
                      }
                      queryString = "SELECT id_user FROM user_profile WHERE mail='"+mail+"' or fb_id='"+fb_id+"'";
                      connection.query(queryString, function(err,data) {
                        if (err)
                        {
                          
                          res.json({application:appName,success:"false",message:"ServerError",data:response});
                          return;
                        }
                        // on success returning user_id
                        response.id_user = data[0].id_user;
                        res.json({application:appName,success:"true",message:"",data:response});
                        
                    });

                  });
                  return;
                }
                else
                {

                  res.json({application:appName,success:"false",message:"ServerError",data:response});
                  return;
                }
              }
              // if new user then retuning id of user that is inserted
              response.id_user = data.insertId;
              res.json({application:appName,success:"true",message:"",data:response});
          });
        });
    }
});

//---------------------------------------------
// 2 - Check Email is Registered or not?
//---------------------------------------------
//In this webservice, Communicate with "user_profile" and it will response in json form (Status and validatedis user validated or not) 
app.get('/check_the_mail/:email', function(req, res) {
  res.type('application/json');
  var email = req.params.email;

  queryString = "SELECT mail,status,validated FROM user_profile where mail='"+email+"'";

  connection.query(queryString, function(err, data, fields) {
    response = new Object();
    if (err){
      res.json({application:appName,success:"false",message:"ServerError",data:response});
    }

    if(data.length>0)
    {
      response.status = data[0].status;
      response.validated = data[0].validated;
      res.json({application:appName,success:"true",message:"",data:response});
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }
});
  
  
});

//---------------------------------------------
// 3- Check User  Password  (mail,  pass)
//---------------------------------------------
//In this web service,communicate with "user_profile" and it will return a response in json form (user id and validated(is user validated or not))
app.get('/check_user_password/:mail/:pass',function(req,res){
  res.type('application/json');

  var mail = req.params.mail;
  var pass = req.params.pass;
  queryString = "SELECT id_user, validated FROM user_profile WHERE mail='"+mail+"' and pass='"+pass+"'";
  
  connection.query(queryString, function(err,data) {
    response = new Object();
    if (err)
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    else{
      
      if(data.length > 0)
      {
        response.id_user = data[0].id_user;
        response.validated = data[0].validated;
        res.json({application:appName,success:"true",message:"",data:response});  
        
      }
      else
      {
        res.json({application:appName,success:"false",message:"",data:response});
      }
    }
  });
});

//---------------------------------------------
//4: Register User WITH MAIL

// E2 - REMEMBER THE 4 CASES ON THE REGISTRATION OR LOGIN 
// 1- ACCESS THROUGH MAIL FIRST TIME 
// 2- ACCESS THROUGH MAIL ONCE THE GUY IS REGISTRED THROUGH FB (JUST UPDATE THE PASSWORD), 
// 3- ACCESS THROUGH MAIL ONCE SOMEONE REGISTRED HIM THROUGH MAIL (JUST UPDATE THE PASSWORD), 
// 4- ACCESS THROUGH MAIL ONCE SOMEONE REGISTRED HIM THROUGH FB (THATS CRITICAL... WE DONT IDENTIFY THE FB_ID WITH THE EMAIL..WE JUST INSERT THE USER AS A NEW ONE...))

// ON THIS WEBSERVICE... I DONT UNDERSTAND WHY YOU GET ALL THIS FIELDS.... ON THE SPECIFICATION THERE ARE ONLY TWO FIELDS...MAIL AND PASSWORD.... PLEASE CORRET THAT.

//---------------------------------------------
//In this webservice, communicate with "user_profile" and will response as json confirmation (Email sent or any error)
app.get('/registerUser/:mail/:pass', function(req, res) {
  res.type('application/json');

  var mail = req.params.mail;
  var pass = req.params.pass;

  var server  = emaile.server.connect({
     user:    "email of developer", 
     password:"password of developer", 
     host:    "smtp.gmail.com", 
     ssl:     true
  });

  //FIRST TIME USER REGISTER IN THE APPLICATION
  queryString = "INSERT INTO user_profile SET mail='"+mail+"',pass='"+pass+"'";

  connection.query(queryString, function(err,data) {
    if (err)
    {
      if (err.code == "ER_DUP_ENTRY")
      { 
          //IF USER ALREADY REGISTRED THROUGH FB OR SOMEONE INVITE HIM,WE JUST UPDATE THE INFORMATION.
        queryString = "UPDATE user_profile SET pass='"+pass+"', validated=0 WHERE mail='"+mail+"'";

        connection.query(queryString, function(err,data) {
          response = new Object();
          if (err)
          {
            res.json({application:appName,success:"false",message:"ServerError",data:response});
            return;
          }

            // send the message and get a callback with an error or details of the message that was sent
            server.send({
               text:    "Text/Content of mail", 
               from:    "you <developer mail>", 
               to:      "someone <"+mail+">",
               subject: "Subject of mail"
            }, 
            function(err, message) 
            {
              if (err)
              {
                res.json({application:appName,success:"false",message:"ServerError",data:response});
                return;
              }
            });

            res.json({application:appName,success:"true",message:"",data:response});
          });

        return;
      }
      else
      {
        response = new Object();
        res.json({application:appName,success:"false",message:"ServerError",data:response});
        return;
      }
    }
      // send the message and get a callback with an error or details of the message that was sent
      server.send({
         text:    "Text/Content of mail", 
         from:    "you <developer mail>", 
         to:      "someone <"+mail+">",
         subject: "Subject of mail"
      }, 
      function(err, message) 
      {
        if (err)
        {
          res.json({application:appName,success:"false",message:"ServerError",data:response});
          return;
        }

        res.json({application:appName,success:"true",message:"",data:response});
      });

  });

}); 

//--------------------------------------------
// 4.2 VALIDATE YOUR EMAIL THROUGH EMAIL SEND IT TO YOUR INBOX
// IF THE MAIL IS NOT VALIDATED, YOU COULDNT ACCESS...
//--------------------------------------------
//In this webservice, Communicate with "user_profile",it will return json response validate(successfully or not)
app.get('/validate_user_mail/:mail', function(req, res) {
  res.type('application/json');

  var mail = req.params.mail;

  queryString = "UPDATE user_profile SET validated=1 WHERE mail='"+mail+"'";

        connection.query(queryString, function(err,data) {
          response = new Object();
          if (err)
          {
            res.json({application:appName,success:"false",message:"ServerError",data:response});
            return;
          }
			response.message="successfully validated";
          res.json({application:appName,success:"true",message:"",data:response});
      });
  
});

//---------------------------------------------
//5: Check Your Role

//---------------------------------------------
//In this webservice, Communicate with "user_profile",In response it will return user role (0(User),1(Seller),2(Admin)).
app.get('/check_your_role/:id_user', function(req, res) {
  res.type('application/json');
  var id_user = req.params.id_user;
  var pass=req.params.password;
  queryString = "SELECT role FROM user_profile where id_user='"+id_user+"'";

  connection.query(queryString, function(err, data, fields) {
    if (err) 
    {
      response = new Object();
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }

//--------IS NECESSARY THAT "IF" WHY YOU DONT RESPONSE DIRECTLY THE ROLL?
    
    response = new Object();
    if(data.length>0)
    {
      response.role = data[0].role;
      res.json({application:appName,success:"true",message:"",data:response});
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }
  });
});


//---------------------------------------------
//6: Check General Events (date, city_user_now, id_last_event)
// E6 - HOW YOU CALCULATE THE DATE_START AND THE DATE END?

//---------------------------------------------

function Event(id_event, id_local,title,date_start,date_end,details,ticket_cost,vip_cost,list_id,name)
{
       // Add object properties like this
       this.id_event=id_event;
       this.name_local=name;
       this.id_local=id_local;
       this.title=title;
       this.date_start=date_start;
       this.date_end=date_end;
       this.details=details;
       this.ticket_cost=ticket_cost;
       this.vip_cost=vip_cost;
       this.list_id=list_id;
     }


// logically, every event have two dates, start date and end date, or at least start time and end time, so user should pass the dates for event table
// if you observe I have modified bit more
//-----------------------------------------------------------
//In this web-service, Communicate with databases "event" and "local", it will response a list of events
//of current city and specific date.
app.get('/check_events/:date/:current_city/:last_event_id', function(req, res) {//:current_city/:last_event_id
    //connection.connect();
    res.type('application/json');
    var date= req.params.date;
    var current_city=req.params.current_city;
    var last_event_id=req.params.last_event_id;

//-----WHY YOU FIX THE LOCAL EVENT?
queryString = "SELECT event.*,local.* FROM event, local where event.id_event >="+last_event_id+" and '"+date+"'>=event.date_start and local.city='"+current_city+"' and local.id_local=event.id_local";

connection.query(queryString, function(err, data, fields) {
  response = new Object();
  if (err)
  {
    res.json({application:appName,success:"false",message:"ServerError",data:response});
    return;
  }

  if(data.length>0)
  {
    var list = []; 
    for(var i=0;i<data.length;i++)
    {
      list.push(new Event(data[i].id_event,data[i].id_local,data[i].title,data[i].date_start,data[i].date_end,data[i].details,data[i].ticket_cost,data[i].vip_cost,data[i].list_id,data[i].name));
    }

    res.json({application:appName,success:"true",message:"",data:list});
  }
  else
  {
    res.json({application:appName,success:"false",message:"",data:response});
  }
});
});

//---------------------------------------------
// 7- Download THE FIRST Image
// E10 - BE CAREFUL ON THE EVENTS TABLE IT DOESNT APPEAR ANY IMAGE....EQUAL AS LOCAL
//---------------------------------------------
// you are observing here, table is changed, its not 'event' table, its 'event_image' that has relation with 'event' table
//-----------------------------------------------------
//In this webservice, Communicate with "event_local_image", it will response a json,We can get Images using "data" node of json.  
app.get('/download_images/:id_event', function(req, res) {
  res.type('application/json');

  var id_event = req.params.id_event;

  queryString = "SELECT image FROM event_local_image where event_id='"+id_event+"'";

  connection.query(queryString, function(err, data, fields) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.length>0)
    {
      var bufferBase64 = new Buffer(data[0].image).toString('base64');
      response.image = bufferBase64;
      res.json({application:appName,success:"true",message:"",data:response});
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }
  });

}); 

//---------------------------------------------
//8 - Check messages
//---------------------------------------------
//In this webservice, Communicate with "message",it will response a json , 
//get resonse data using node "data" of json.
app.get('/check_messages/:id_user', function(req, res) {
  res.type('application/json');

  var id_user = req.params.id_user;

    queryString = "SELECT id_message FROM message where id_user_receive='"+id_user+"'";// and new_message=true

    connection.query(queryString, function(err, data, fields) {
      response = new Object();
      if (err) 
      {
        res.json({application:appName,success:"false",message:"ServerError",data:response});
        return;
      }

      if(data.length>0)
      {
        response.message = data.length+" new Messages";
        res.json({application:appName,success:"true",message:"",data:response});
      }
      else
      {
        
        res.json({application:appName,success:"false",message:"",data:response});
      }
    });

  }); 

//---------------------------------------------
//9- Check_events_images(id_event, IMAGE_NUMBER)
// YOU HAVE TO DOWNLAD THE REST OF IMAGES THAT PROBABLY THE LOCAL OR THE EVENT HAVE.
//---------------------------------------------
////In this webservice, Communicate with "event_local_image",it will response json , get the rest of images using "data" node. 
app.get('/download_rest_images/:id_event/:image_number', function(req, res) {
  res.type('application/json');

  var id_event = req.params.id_event;
  var image_number = parseInt(req.params.image_number)-1;

  queryString = "SELECT image FROM event_local_image where event_id='"+id_event+"'";

  connection.query(queryString, function(err, data, fields) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.length>0)
    {
      if(image_number < data.length)
      {
        var bufferBase64 = new Buffer(data[image_number].image).toString('base64');
        response.image = bufferBase64;
        res.json({application:appName,success:"true",message:"",data:response});
      }
      else
      {
        res.json({application:appName,success:"false",message:"",data:response}); 
      }
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }
  });

});
//---------------------------------------------
//11  -   11 - Check_Sell_points (id_local, city_user_now)  
//E11 - THATS STILL NOT CORRECT. THIS WEBSERVICE HAVE TO RETUR ¡¡¡SELLERS!!!! AND LOCALS (HOW SELL TICKETS FOR THAT EVENT... IMPORTANT... NOR AL THE USERS AND LOCALS) THAT IS ARROUND THE USER (CITY)
//---------------------------------------------
//In this webservice, Communicate with databases "local","user_profile" and "admin_seller" and will response a list of sellers and locals in node "data" of json
app.get('/check_sell_points/:id_local/:current_city', function(req, res) {
    res.type('application/json');
  
    var current_city=req.params.current_city;
    var id_local=req.params.id_local;
  
    queryString = "SELECT local.*, user_profile.name as username, user_profile.city as usercity, user_profile.mobile_number as mn, admin_seller.id_user as iu, admin_seller.latitude as lati, admin_seller.longitude as longi ";
    queryString += "FROM local,user_profile,admin_seller ";
    queryString += "where local.id_local='"+id_local+"' and local.id_user_admin=admin_seller.id_user and local.id_user_admin=user_profile.id_user and user_profile.city='"+current_city+"'";
     
    var id_user_admin;
    connection.query(queryString, function(err, rows, fields) {
      response = new Object();
      if (err) 
      {
        res.json({application:appName,success:"false",message:"ServerError",data:response});
        return;
      }
      
      if(rows.length>0)
      {
        var list = []; 
        
        var obj = new Object();
        id_user_admin = rows[0].id_user_admin;
        obj.id_user = rows[0].id_user_admin;
        obj.latitude = rows[0].latitude;
        obj.longitude = rows[0].longitude;
        obj.name = rows[0].name;
        obj.city_adress = rows[0].city_adress;
        obj.mobile_number = rows[0].telephone;
        obj.sell_point = "local";
        
        list.push(obj);
        
        obj = new Object();
        obj.id_user = rows[0].id_user_admin;
        obj.latitude = rows[0].lati;
        obj.longitude = rows[0].longi;
        obj.username = rows[0].username;
        obj.city_adress = rows[0].usercity;
        obj.mobile_number = rows[0].mn;
        obj.sell_point = "admin";
            
        list.push(obj);
        
        queryString = "SELECT admin_seller.*, user_profile.* ";
        queryString += "from groups_users, group_user, admin_seller, user_profile ";
        queryString += "where groups_users.id_group = group_user.id_group and groups_users.id_admin_seller='"+id_user_admin+"' and group_user.id_user=admin_seller.id_user and group_user.id_user=user_profile.id_user and user_profile.city='"+current_city+"'";
       
        var id_user_admin;
        connection.query(queryString, function(err, rows, fields) {
          if (err) throw err;
          if(rows.length > 0)
          {
          for(var i=0;i < rows.length; i++)
          {
            obj = new Object();
            obj.id_user = rows[0].id_user;
            obj.latitude = rows[0].latitude;
            obj.longitude = rows[0].longitude;
            obj.name = rows[0].name;
            obj.city_adress = rows[0].city;
            obj.mobile_number = rows[0].mobile_number;
            obj.sell_point = "seller";
            
            list.push(obj);
          }
          }
          
        });
        
        res.json({application:appName,success:"true",message:"",data:list});
      }
    });
});

//---------------------------------------------
 // 11.2- Probably we need to register the lat and long for the sellers...
//---------------------------------------------
//In this webservice, Communicate with "admin_seller",it will response as confirmation in
//"data" node for successfully or unsuccessfully registered.
app.get('/register_lat_long_sellers/:id_user/:latitude:/longitude', function(req, res) {
  res.type('application/json');

  var id_user = req.params.id_user;
  var longitude = req.params.longitude;
  var latitude = req.params.latitude;

  queryString = "INSERT INTO admin_seller SET id_user='"+id_user+"', longitude='"+longitude+"', latitude='"+latitude+"'";

  connection.query(queryString, function(err,data) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }

    if(data.affectedRows>0)
    {
	  response.message="successfully registered"
      res.json({application:appName,success:"true",message:"",data:response});
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }
  });

});


 //---------------------------------------------
 // 12- List_Sign_up (id_user)
 // thats not correct????? what is is_premier??? which field is that??? you have to fill the table of TIKETS...sign up to a list is like buy a ticket...
 //---------------------------------------------

// we could load this INFORMATION when we load local or event's info at backend
//-----------------------------------------------
//In this webservice, Communicate with "tickets" and will response json result(check success is true or false). 
 app.get('/list_sign_up/:id_user/:id_event/:id_local/:id_user_sold/:city', function(req, res) {
  res.type('application/json');

  var id_user = req.params.id_user;
  var id_event = req.params.id_event;
  var id_local = req.params.id_local;
  var id_user_sold = req.params.id_user_sold;
  var city = req.params.city;

  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth()+1; //January is 0!
  var yyyy = today.getFullYear();
  if(dd<10){
    dd='0'+dd
  } 
  if(mm<10){
    mm='0'+mm
  } 
  var date = yyyy+'-'+mm+'-'+dd;

  queryString = "INSERT INTO tickets SET id_user_buy='"+id_user+"', id_event='"+id_event+"', id_local='"+id_local+"', id_user_sold='"+id_user_sold+"', city_ticket_sold='"+city+"', date='"+date+"'";

  connection.query(queryString, function(err,data) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.affectedRows > 0)
    {
      res.json({application:appName,success:"true",message:"",data:response});
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }

  });

});

//---------------------------------------------
//13- Check_locals (city_user_now, id_last_local)
//---------------------------------------------
//In this webservice, Communicate with "local" and will response json, if "success" is "true", 
//we will get list of locals in "data" node else empty "data" node
app.get('/check_locals/:current_city/:last_local_id', function(req, res) {
  res.type('application/json');
  var current_city=req.params.current_city;
  var last_local_id=req.params.last_local_id;
  queryString = "SELECT * FROM local where id_local >='"+last_local_id+"' and city='"+current_city+"'";

  connection.query(queryString, function(err, data, fields) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.length>0)
    {
      var list = []; 
      for(var i=0;i<data.length;i++)
      {
        var obj = new Object();
        obj.id_local = data[i].id_local;
        obj.name = data[i].name;
        obj.city_adress = data[i].city_adress;
        obj.telephone = data[i].telephone;
        obj.latitude = data[i].latitude;
        obj.longitude = data[i].longitude;
        obj.telephone = data[i].telephone;
        obj.details = data[i].details;
        obj.cc_number = data[i].cc_number;
        obj.cif_identifier = data[i].cif_identifier;

        list.push(obj);
      }
      res.json({application:appName,success:"true",message:"",data:list});
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }
  });
});

//---------------------------------------------
// 14 - Search_locals (text)
//---------------------------------------------
//In this webservice, Communicate with "local" and rsponse json if "success" is "true" 
//then list of local will returned else empty in "data" node
app.get('/search_locals/:text', function(req, res) {
  res.type('application/json');
  var text=req.params.text;
  queryString = "SELECT * FROM local where name LIKE '%"+text+"%' OR details LIKE '%"+text+"%'";

  connection.query(queryString, function(err, data, fields) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.length>0)
    {
      var list = []; 
      for(var i=0;i<data.length;i++)
      {
        var obj = new Object();
        obj.id_local = data[i].id_local;
        obj.name = data[i].name;
        obj.city_adress = data[i].city_adress;
        obj.telephone = data[i].telephone;
        obj.latitude = data[i].latitude;
        obj.longitude = data[i].longitude;
        obj.telephone = data[i].telephone;
        obj.details = data[i].details;
        obj.cc_number = data[i].cc_number;
        obj.cif_identifier = data[i].cif_identifier;

        list.push(obj);
      }
      res.json({application:appName,success:"true",message:"",data:list});
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }
  });
});

//---------------------------------------------
// 15-  Check_local_events(id_local)
//---------------------------------------------
//In this webservice, Communicate with "local" and "event" and response events of
// specific local in "data" node of json object.
app.get('/check_local_events/:id_local', function(req, res) {
  res.type('application/json');
  var id_local=req.params.id_local;
  queryString = "SELECT local.*, event.* FROM local, event where event.id_local=local.id_local ORDER BY event.date_start";

  connection.query(queryString, function(err, data, fields) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.length>0)
    {
      var list = []; 
      for(var i=0;i<data.length;i++)
      {
        var obj = new Object();
        obj.id_local = data[i].id_local;
        obj.id_event = data[i].id_event;
        obj.title = data[i].title;
        obj.date_start = data[i].date_start;
        obj.date_end = data[i].date_end;
        obj.name = data[i].name;
        obj.city_adress = data[i].city_adress;
        obj.telephone = data[i].telephone;
        obj.latitude = data[i].latitude;
        obj.longitude = data[i].longitude;
        obj.telephone = data[i].telephone;
        obj.details = data[i].details;
        obj.cc_number = data[i].cc_number;
        obj.cif_identifier = data[i].cif_identifier;

        list.push(obj);
      }
      res.json({application:appName,success:"true",message:"",data:list});
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }
  });
});

//---------------------------------------------
//16- Check_My_Tickets(id_user)
// THIS INFORMATION IS ONLY TO SHOW ON P29... YOU ARE GIVING TO MUCH INFORMATION..NO?
//---------------------------------------------
////In this webservice, Communicate with "tickets","local" and "event" and response tickets list with event and
// local info of specific user against its user id,in "data" node of json in case of success is "true" else empty object.
app.get('/check_my_tickets/:id_user', function(req, res) {
  res.type('application/json');

  var id_user=req.params.id_user;
  queryString = "SELECT tickets.*,event.*,local.* ";
  queryString += "FROM tickets,local,event ";
  queryString += "WHERE tickets.id_user_buy ='"+id_user+"' and tickets.id_event=event.id_event and tickets.id_local=local.id_local";

  connection.query(queryString, function(err, data, fields) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.length>0)
    {
      var list = []; 
      for(var i=0;i<data.length;i++)
      {
        var obj = new Object();
        obj.id_local = data[i].id_local;
        obj.name = data[i].name;
        obj.id_event = data[i].id_event;
        obj.title = data[i].title;
        obj.city_adress = data[i].city_adress;
        obj.telephone = data[i].telephone;

        list.push(obj);
      }
      res.json({application:appName,success:"true",message:"",data:list});
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }
  });
});

//---------------------------------------------
// 17- Check_My_Messages(id_user)
// could you explain me this webservice?
//---------------------------------------------
//In this webservice, Communicate with "user_profile" and "message" and in response in json form.
//we will get data from "data" node of json. As messages returned, these will be deleted from database.
app.get('/check_my_messages/:id_user', function(req, res) {
  res.type('application/json');
  var id_user=req.params.id_user;

  // for individual messages

  queryString = "Select m.id_user_send, u.name, count(m.message_text) num_msg, m.date_send, m.message_text ";
  queryString += "From user_profile u, (Select * From message WHERE id_group_list=0 ORDER BY id_message DESC) m ";
  queryString += "Where m.id_user_receive = "+id_user+" and m.id_user_send=u.id_user ";
  queryString += "group by m.id_user_send";

  // for group messages

  // queryString = "Select m.id_group_list, gl.title, gl.type, count(m.message_text) num_msg, m.date_send, m.message_text ";
  // queryString += "From group_list gl, (Select * From message WHERE id_group_list != 0 ORDER BY id_message DESC) m ";
  // queryString += "Where m.id_user_receive = "+id_user+" and m.id_group_list=gl.id_group_list ";
  // queryString += "group by m.id_group_list";

  connection.query(queryString, function(err, data, fields) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.length>0)
    {
      var list = [];
    
      for(var i=0;i<data.length;i++)
      {
        var obj = new Object();

        obj.id_user_send = data[i].id_user_send;
        obj.name = data[i].name;
        obj.num_msg = data[i].num_msg;
        obj.date_send = data[i].date_send;
        obj.message_text = data[i].message_text;

        list.push(obj);
        
      }
    
      queryString = "DELETE FROM message ";
      queryString += "WHERE id_user_receive ='"+id_user+"'";
      connection.query(queryString, function(err, data, fields) {
        if (err) 
        {
          res.json({application:appName,success:"false",message:"ServerError",data:response});
          return;
        }
        res.json({application:appName,success:"true",message:"",data:list});
      });
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }
  });
});

//---------------------------------------------
// 18- send_message(text, id_user_sender, id_user_receive)
// REMEMBER TO SEND THE PUSH NOTIFICATION TO THE OTHER USER..JUST PREPARE IT.
// Add a new parameter on the webserivce... if the message is send it through a group or not... and probably we could group the webservice 18 with the 29 (send image)
//---------------------------------------------

// if message is sent to a group then id_group will contain id of group otherwise it would be null(0)
//In this webservice, Communicate with "message", In Json response we get "success" in form of "true" or "false" (confirmation).  
app.get('/send_message/:text/:image/:id_user_sender/:id_user_receive/:id_group', function(req, res) {
  res.type('application/json');

  var text = req.params.text;
  var image=req.params.image;
  var id_user_sender = req.params.id_user_sender;
  var id_user_receive = req.params.id_user_receive;
  var id_group = req.params.id_group;
  
    queryString = "INSERT INTO message SET image='"+image+"', message_text='"+text+"', id_user_send='"+id_user_sender+"', id_user_receive='"+id_user_receive+"', id_group_list='"+id_group+"'";
    
    connection.query(queryString, function(err,data) {
      response = new Object();
      if (err) 
      {
        res.json({application:appName,success:"false",message:"ServerError",data:response});
        return;
      }
      if(data.affectedRows > 0)
      {
        res.json({application:appName,success:"true",message:"",data:response});
        
      }
      else
      {
        res.json({application:appName,success:"false",message:"",data:response});
      }
      
    });
    
  }); 

//---------------------------------------------
//19 - Receive_messages (id_user,id_user_sender)
//WE DELETE DATE_LAST_UPDATE... BECAUSE ONCE I DOWNLOAD THE MESSAGE, I DELETE FORM THE SERVER. PLEASE CORRECT IT
//---------------------------------------------
//In this webservice, Communicate with "message", we get Json response in case of "success" is "true" , node "data"
//have text message in it. Once it will resieve and download , then message will delete.
app.get('/receive_messages/:id_user/:id_user_sender', function(req, res) {
  res.type('application/json');

  var id_user = req.params.id_user;
  var id_user_sender = req.params.id_user_sender;

  queryString = "SELECT message_text, date_send, id_group_list ";
  queryString += "FROM message "
  queryString += "WHERE id_user_send="+id_user_sender+" and id_user_receive="+id_user;
  queryString += "ORDER BY date_send DESC";

  connection.query(queryString, function(err,data) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.length > 0)
    {
      var list = [];
      for(var i=0;i<data.length;i++)
      {
       var obj = new Object();
       obj.message_text = data[i].message_text;
       obj.date = data[i].date;
       list.push(obj);
      }
      queryString = "Delete FROM message WHERE id_user_send="+id_user_sender+" and id_user_receive="+id_user;
      connection.query(queryString, function(err,data) {
          response = new Object();
          if (err) 
          {
            res.json({application:appName,success:"false",message:"ServerError",data:response});
            return;
          }
          res.json({application:appName,success:"true",message:"",data:list});
      });
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }

});

});

//---------------------------------------------
//20: Update User
// E13 - USER NEVER COULD CHANGE THEIR PASSWORD...STILL WRONG...
//---------------------------------------------
// it was according to PDF file, but now updated
//---------------------------------------------
//In this webservice, Communicate with "user_profile", As response we will get json , in case of success node tru ,
// it means updated successfully else any problem.
app.get('/updateUser/:user_id/:name/:mail/:sex/:age', function(req, res) {
  res.type('application/json');

  var uId = req.params.user_id;
  var name = req.params.name;
  var email = req.params.mail;
  var sex = req.params.sex;
  var age = req.params.age;

  queryString = "Update user_profile SET name='"+name+"',mail='"+email+"',sex='"+sex+"',age='"+age+"' where id_user='"+uId+"'";

  connection.query(queryString, function(err,data) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.affectedRows > 0)
    {   
      res.json({application:appName,success:"true",message:"",data:response}); 
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response}); 
    }

  });

}); 

//---------------------------------------------
 //21 - Upadate_user_rol (id_user, local, adress, CIF, phone, etc.)
// E14 - THIS IS NOT CORRECT. USER COULD CHANGE THEIR ROLE ONCE HE UPDATE THEIR PROFILE WITH DATA FROM A LOCAL. THEN WE REVIEW THE LOCAL INFORMATION AND WE UPDATE THEIR ROLE... 
 //---------------------------------------------
 
 // below is webservice that actually verifies or delete
 
 // ADIL, NO BODY COULD REGISTER A LOCAL IF IS NOT AN ADMINISTRATOR. THE FIRST LOCAL THAT YOU COULD REGISTER IT WILL DO IT THROUGH PAGE P7.2... THAT'S WHY THIS WEBSERVICE IS NOT CORRECT.
//-------------------------------------------
//In this webservice, Communicate with "local", we will get response in json form , in case of success is true means updated.
 app.get('/update_user_role/:id_user/:latitude/:longitude/:name/:cif_identifier/:cc_number/:city_adress/:city/:telephone/:detail', function(req, res) {
  res.type('application/json');

  var id_user = req.params.id_user;
  var latitude = req.params.latitude;
  var longitude = req.params.longitude;
  var name = req.params.name;
  var cif_identifier = req.params.cif_identifier;
  var cc_number = req.params.cc_number;
  var city_adress = req.params.city_adress;
  var city = req.params.city;
  var telephone = req.params.telephone;
  var detail = req.params.detail;

  queryString = "INSERT INTO local SET role_update_status='pending', latitude='"+latitude+"', longitude='"+longitude+"', name='"+name+"', cif_identifier='"+cif_identifier+"', cc_number='"+cc_number+"', city_adress='"+city_adress+"', city='"+city+"', telephone='"+telephone+"', id_user_admin='"+id_user+"', details='"+detail+"'";
  
  connection.query(queryString, function(err,data) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.affectedRows > 0)
    {   
      res.json({application:appName,success:"true",message:"",data:response}); 
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response}); 
    }

  });

}); 

//---------------------------------------------
 //21.2 - verify_user_role (id_user, Id_local, verify)
 //could you explain me this webservice work?
//---------------------------------------------

// this webservice is to verify the user role update when he creates a local to become admin
//In this webservice, Communicate with "local", as a response , success true means verified else not(verify can be delete or update).
app.get('/verify_user_role/:id_user/:id_local/:verify', function(req, res) {
  res.type('application/json');

  var id_user = req.params.id_user;
  var id_local = req.params.id_local;
  var verify = req.params.verify;

  if(verify == "delete")
  {
    queryString = "DELETE FROM local where id_user_admin='"+id_user+"' and id_local='"+id_local+"'";
    
    connection.query(queryString, function(err,data) {
      response = new Object();
      if (err) 
      {
        res.json({application:appName,success:"false",message:"ServerError",data:response});
        return;
      }
      if(data.affectedRows > 0)
      {   
        res.json({application:appName,success:"true",message:"",data:response}); 
      }
      else
      {
        res.json({application:appName,success:"false",message:"",data:response}); 
      }
      
    });
  }
  else
  {
    queryString = "Update local SET role_update_status='updated' where id_user_admin='"+id_user+"' and id_local='"+id_local+"'";
    
    connection.query(queryString, function(err,data) {
      response = new Object();
      if (err) 
      {
        res.json({application:appName,success:"false",message:"ServerError",data:response});
        return;
      }
      if(data.affectedRows > 0)
      {
        queryString = "Update user_profile SET role=3 where id_user='"+id_user+"'";

        connection.query(queryString, function(err,data) {
          if (err) 
          {
            res.json({application:appName,success:"false",message:"ServerError",data:response});
            return;
          }
          if(data.affectedRows > 0)
          {   
            res.json({application:appName,success:"true",message:"",data:response}); 
          }
          else
          {
            res.json({application:appName,success:"false",message:"",data:response}); 
          }
        });   
      }
      else
      {
        res.json({application:appName,success:"false",message:"",data:response}); 
      }

    });
  }

});

 //---------------------------------------------
//22- Check_statistics(id_local, id_event, id_user)
// you miss the id_user... because if you are the admin, you could check your general statistics for the event... but if you are a seller, you only could see your data... not generic one...
// can you explain me this webservice?

//---------------------------------------------
//In this webservice, Communicate with "role","user_profile","local","event" and
// return a json , in case of success is true then we get the statistics.
app.get('/check_statistics/:id_local/:id_event/:id_user', function(req, res) {
  res.type('application/json');
  response = new Object();
  var local_id = req.params.id_local;
  var event_id = req.params.id_event;
  var id_user = req.params.id_user;
  var obj = new Object();

  var count = 0;
  var nextProcess = function(obj){
    if(count==12)
     res.json({application:appName,success:"true",message:"",data:obj});
   count++;
 }

  queryString = "SELECT role FROM user_profile WHERE id_user='"+id_user+"'";
  connection.query(queryString, function(err,dataRows) {
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(dataRows.length>0){
      if(dataRows[0].role == 2)
      {
        queryString = "SELECT COUNT(id_ticket) as total FROM tickets WHERE id_local='"+local_id+"' and id_event='"+event_id+"' and id_user_buy='"+id_user+"'";
      }
      else if(dataRows[0].role == 3)
      {
        queryString = "SELECT COUNT(id_ticket) as total FROM tickets WHERE id_local='"+local_id+"' and id_event='"+event_id+"'";
      }
      else
      {
        res.json({application:appName,success:"false",message:"ServerError",data:response});
        return;
      }
     connection.query(queryString, function(err,data) {
      if (err) 
      {
        res.json({application:appName,success:"false",message:"ServerError",data:response});
        return;
      }
      if(data.length>0){
       obj.total_tickets_Sale=data[0].total;
       nextProcess(obj);
     }
    });
     var today = new Date();
     var dd = today.getDate();
        var mm = today.getMonth()+1; //January is 0!

        var yyyy = today.getFullYear();
        if(dd<10){
          dd='0'+dd
        } 
        if(mm<10){
          mm='0'+mm
        } 
        var today = yyyy+'-'+mm+'-'+dd;

        if(dataRows[0].role == 2)
        {
          queryString ="SELECT COUNT(id_ticket) as total FROM tickets WHERE date_sold='"+today+"' and id_user_buy='"+id_user+"'";
        }
        else if(dataRows[0].role == 3)
        {
          queryString ="SELECT COUNT(id_ticket) as total FROM tickets WHERE date_sold='"+today+"'";
        }
        else
        {
          res.json({application:appName,success:"false",message:"ServerError",data:response});
          return;
        }

        
        
        connection.query(queryString, function(err,data) {
          if (err) 
          {
            res.json({application:appName,success:"false",message:"ServerError",data:response});
            return;
          }
          if(data.length>0){
            obj.today_ticket_sale=data[0].total;
            nextProcess(obj);
          }
        });
        if(dataRows[0].role == 2)
        {
          queryString = "SELECT COUNT(id_ticket) as total FROM tickets WHERE id_local='"+local_id+"' and id_event='"+event_id+"' and ticket_type=1 and id_user_buy='"+id_user+"'";
        }
        else if(dataRows[0].role == 3)
        {
          queryString = "SELECT COUNT(id_ticket) as total FROM tickets WHERE id_local='"+local_id+"' and id_event='"+event_id+"' and ticket_type=1";
        }
        else
        {
          res.json({application:appName,success:"false",message:"ServerError",data:response});
          return;
        }
        
        connection.query(queryString, function(err,data) {
          if (err) 
          {
            res.json({application:appName,success:"false",message:"ServerError",data:response});
            return;
          }
          if(data.length>0){
           obj.total_POS_ticket_sale=data[0].total;
           nextProcess(obj);

         }
       });
        if(dataRows[0].role == 2)
        {
          queryString = "SELECT COUNT(id_ticket) as total FROM tickets WHERE id_local='"+local_id+"' and id_event='"+event_id+"' and ticket_type=2 and id_user_buy='"+id_user+"'";
        }
        else if(dataRows[0].role == 3)
        {
          queryString = "SELECT COUNT(id_ticket) as total FROM tickets WHERE id_local='"+local_id+"' and id_event='"+event_id+"' and ticket_type=2";
        }
        else
        {
          res.json({application:appName,success:"false",message:"ServerError",data:response});
          return;
        }
        connection.query(queryString, function(err,data) {
          if (err) 
          {
            res.json({application:appName,success:"false",message:"ServerError",data:response});
            return;
          }
          if(data.length>0){
           obj.total_online_ticket_sale=data[0].total;
           nextProcess(obj);
         }
       });
        if(dataRows[0].role == 2)
        {
          queryString = "SELECT COUNT(id_ticket) as total FROM tickets WHERE id_local='"+local_id+"' and id_event='"+event_id+"' and ticket_type=3 and id_user_buy='"+id_user+"'";
        }
        else if(dataRows[0].role == 3)
        {
          queryString = "SELECT COUNT(id_ticket) as total FROM tickets WHERE id_local='"+local_id+"' and id_event='"+event_id+"' and ticket_type=3";
        }
        else
        {
          res.json({application:appName,success:"false",message:"ServerError",data:response});
          return;
        }
        connection.query(queryString, function(err,data) {
          if (err) 
          {
            res.json({application:appName,success:"false",message:"ServerError",data:response});
            return;
          }
          if(data.length>0){
           obj.total_VIP_ticket_sale=data[0].total;
           nextProcess(obj);
         }
       });
        if(dataRows[0].role == 2)
        {
          queryString = "SELECT COUNT(id_ticket) as total FROM tickets WHERE id_local='"+local_id+"' and id_event='"+event_id+"' and ticket_type=4 and id_user_buy='"+id_user+"'";
        }
        else if(dataRows[0].role == 3)
        {
          queryString = "SELECT COUNT(id_ticket) as total FROM tickets WHERE id_local='"+local_id+"' and id_event='"+event_id+"' and ticket_type=4";
        }
        else
        {
          
          res.json({application:appName,success:"false",message:"ServerError",data:response});
          return;
        }
        
        connection.query(queryString, function(err,data) {
          if (err) 
          {
            res.json({application:appName,success:"false",message:"ServerError",data:response});
            return;
          }
          if(data.length>0){
           obj.total_list_ticket_sale=data[0].total;
           nextProcess(obj);
         }

       });
        if(dataRows[0].role == 2)
        {
          queryString = "SELECT COUNT(id_ticket) as total FROM tickets WHERE id_local='"+local_id+"' and id_event='"+event_id+"' and ticket_type=1 and date_sold='"+today+"' and id_user_buy='"+id_user+"'";
        }
        else if(dataRows[0].role == 3)
        {
          queryString = "SELECT COUNT(id_ticket) as total FROM tickets WHERE id_local='"+local_id+"' and id_event='"+event_id+"' and ticket_type=1 and date_sold='"+today+"'";
        }
        else
        {
          
          res.json({application:appName,success:"false",message:"ServerError",data:response});
          return;
        }
        
        connection.query(queryString, function(err,data) {
          if (err) 
          {
            res.json({application:appName,success:"false",message:"ServerError",data:response});
            return;
          }
          if(data.length>0){
           obj.today_POS_tickets_sale=data[0].total;
           nextProcess(obj);
         }

       });
        if(dataRows[0].role == 2)
        {
          queryString = "SELECT COUNT(id_ticket) as total FROM tickets WHERE id_local='"+local_id+"' and id_event='"+event_id+"' and ticket_type=2 and date_sold='"+today+"' and id_user_buy='"+id_user+"'";
        }
        else if(dataRows[0].role == 3)
        {
          queryString = "SELECT COUNT(id_ticket) as total FROM tickets WHERE id_local='"+local_id+"' and id_event='"+event_id+"' and ticket_type=2 and date_sold='"+today+"'";
        }
        else
        {
          
          res.json({application:appName,success:"false",message:"ServerError",data:response});
          return;
        }
        
        connection.query(queryString, function(err,data) {
          if (err) 
          {
            res.json({application:appName,success:"false",message:"ServerError",data:response});
            return;
          }
          if(data.length>0){
           obj.today_online_tickets_sale=data[0].total;
           nextProcess(obj);
         }

       });
        if(dataRows[0].role == 2)
        {
          queryString = "SELECT COUNT(id_ticket) as total FROM tickets WHERE id_local='"+local_id+"' and id_event='"+event_id+"' and ticket_type=3 and date_sold='"+today+"' and id_user_buy='"+id_user+"'";
        }
        else if(dataRows[0].role == 3)
        {
          queryString = "SELECT COUNT(id_ticket) as total FROM tickets WHERE id_local='"+local_id+"' and id_event='"+event_id+"' and ticket_type=3 and date_sold='"+today+"'";
        }
        else
        {
          
          res.json({application:appName,success:"false",message:"ServerError",data:response});
          return;
        }
        
        connection.query(queryString, function(err,data) {
          if (err) 
          {
            res.json({application:appName,success:"false",message:"ServerError",data:response});
            return;
          }
          if(data.length>0){
           obj.today_VIP_tickets_sale=data[0].total;
           nextProcess(obj);
         }

       });
        if(dataRows[0].role == 2)
        {
          queryString = "SELECT COUNT(id_ticket) as total FROM tickets WHERE id_local='"+local_id+"' and id_event='"+event_id+"' and ticket_type=4 and date_sold='"+today+"' and id_user_buy='"+id_user+"'";
        }
        else if(dataRows[0].role == 3)
        {
          queryString = "SELECT COUNT(id_ticket) as total FROM tickets WHERE id_local='"+local_id+"' and id_event='"+event_id+"' and ticket_type=4 and date_sold='"+today+"'";
        }
        else
        {
          
          res.json({application:appName,success:"false",message:"ServerError",data:response});
          return;
        }
        
        connection.query(queryString, function(err,data) {
          if (err) 
          {
            res.json({application:appName,success:"false",message:"ServerError",data:response});
            return;
          }
          if(data.length>0){
           obj.today_list_tickets_sale=data[0].total;
           nextProcess(obj);
         }

       });
        
        queryString = "SELECT (SUM(IF(user_profile.sex = 'male', 1,0))/COUNT(user_profile.sex))*100 AS 'male', ";
        queryString += "(SUM(IF(user_profile.sex = 'female', 1,0))/COUNT(user_profile.sex))*100 AS 'female' ";
        
        if(dataRows[0].role == 2)
        {
          queryString += "FROM tickets, user_profile WHERE tickets.id_local='"+local_id+"' and tickets.id_event='"+event_id+"' and tickets.id_user_buy=user_profile.id_user and id_user_buy='"+id_user+"'";
        }
        else if(dataRows[0].role == 3)
        {
          queryString += "FROM tickets, user_profile WHERE tickets.id_local='"+local_id+"' and tickets.id_event='"+event_id+"' and tickets.id_user_buy=user_profile.id_user";
        }
        else
        {
          
          res.json({application:appName,success:"false",message:"ServerError",data:response});
          return;
        }
        
        connection.query(queryString, function(err,data) {
          if (err) 
          {
            res.json({application:appName,success:"false",message:"ServerError",data:response});
            return;
          }
          if(data.length>0){
           obj.male_percent=data[0].male;
           obj.female_percent=data[0].female;
           nextProcess(obj);

         }

       });

        queryString = "SELECT ageList.Age, COUNT(*) TotalPerson FROM user_profile,( ";
         queryString += "SELECT  CASE ";
         queryString += "WHEN user_profile.age BETWEEN 0 AND 18 THEN '00-18' ";
         queryString += "WHEN user_profile.age BETWEEN 19 AND 25 THEN '19-25' ";
         queryString += "WHEN user_profile.age BETWEEN 26 AND 31 THEN '26-31' ";
         queryString += "WHEN user_profile.age BETWEEN 32 AND 36 THEN '32-36' ";
         queryString += "WHEN user_profile.age BETWEEN 37 AND 41 THEN '37-41' ";
         queryString += "WHEN user_profile.age BETWEEN 42 AND 46 THEN '42-46' ";
         queryString += "WHEN user_profile.age BETWEEN 47 AND 51 THEN '47-51' ";
         queryString += "WHEN user_profile.age BETWEEN 52 AND 56 THEN '52-56' ";
         queryString += "WHEN user_profile.age BETWEEN 57 AND 61 THEN '57-61' ";
         queryString += "WHEN user_profile.age BETWEEN 62 AND 100 THEN '62-100' ";
         queryString += "END Age ";
         queryString += "FROM user_profile ";
         queryString += "    ) ageList, tickets ";
    
    
    if(dataRows[0].role == 2)
    {
      queryString += "WHERE tickets.id_local='"+local_id+"' and tickets.id_event='"+event_id+"' and tickets.id_user_buy=user_profile.id_user and id_user_buy='"+id_user+"'";
    }
    else if(dataRows[0].role == 3)
    {
      queryString += "WHERE tickets.id_local='"+local_id+"' and tickets.id_event='"+event_id+"' and tickets.id_user_buy=user_profile.id_user ";
    }
    else
    {
      
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    queryString += "GROUP BY ageList.Age" ;
    connection.query(queryString, function(err,data) {
      if (err) 
      {
        res.json({application:appName,success:"false",message:"ServerError",data:response});
        return;
      }
      if(data.length>0){
        var ageList = [];
        for (var i = 0; i < data.length; i++) {
          var abc = new Object();

          abc.age = data[i].Age;
          abc.total_person = data[i].TotalPerson;

          ageList.push(abc);

        };
        obj.ageStatistic = ageList;
        nextProcess(obj);

      }

    });

    queryString = "SELECT user_profile.city, COUNT(*) as total_users ";
    queryString += "FROM tickets, user_profile ";
    if(dataRows[0].role == 2)
    {
      queryString += "WHERE tickets.id_local='"+local_id+"' and tickets.id_event='"+event_id+"' and tickets.id_user_buy=user_profile.id_user and id_user_buy='"+id_user+"'";
    }
    else if(dataRows[0].role == 3)
    {
      queryString += "WHERE tickets.id_local='"+local_id+"' and tickets.id_event='"+event_id+"' and tickets.id_user_buy=user_profile.id_user ";
    }
    else
    {
      
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    queryString += "GROUP BY user_profile.city" ;
    connection.query(queryString, function(err,data) {
      if (err) 
      {
        res.json({application:appName,success:"false",message:"ServerError",data:response});
        return;
      }
      if(data.length>0){
        var cityList = [];
        for (var i = 0; i < data.length; i++) {
          var abc = new Object();

          abc.city=data[i].city;
          abc.total_users=data[i].total_users;

          cityList.push(abc);

        };
        obj.cityStatistic = cityList;
        nextProcess(obj);

      }

    });
    }
  });

});

//---------------------------------------------
// 23 - register_user_event/:event/:type/:id_user_seller/:num_tickets/:email/:name/:last_name/:phone_number/:age/:city
//---------------------------------------------

// To save into table id_Tickets, id_event, id_local, id_user_buy, id_user_sold, identifier_ticket
// date_sold, type, city_ticket_sold, num_of_tickets
// Register User Event
//In this webservice, communicate with "user_profile" and "ticket", As response we will get json. 
//For success is true is confirmed user resgister event successfully else not.
app.get('/register_user_event/:id_event/:id_local/:id_user_buy/:id_user_sold/:identifier_ticket/:date_sold/:type/:city_ticket_sold/:num_of_tickets/:name/:last_name/:phone_number/:age', function(req, res) {
  res.type('application/json');

    var id_event = req.params.id_event;      //to be stored in db
 var id_local = req.params.id_local;      //to be stored in db
 var id_user_buy = req.params.id_user_buy;    //used for getting id_user from db
    var id_user_sold = req.params.id_user_sold;    //to be stored in db
 var identifier_ticket = req.params.identifier_ticket; //to be stored in db
 var date_sold = req.params.date_sold;     //to be stored in db
 var type = req.params.type;        //to be stored in db
 var city_ticket_sold = req.params.city_ticket_sold;  //to be stored in db
 var num_of_tickets = req.params.num_of_tickets;   //to be stored in db
    var name = req.params.name;        //awaiting usage confirmation from client
    var last_name=req.params.last_name;      //awaiting usage confirmation from client
 var phone_number = req.params.phone_number;    //awaiting usage confirmation from client
    var age = req.params.age;        //awaiting usage confirmation from client
    queryString = "SELECT id_user FROM user_profile WHERE mail ='"+id_user_buy+"'";
 // and name='"+ name +"'";    
 connection.query(queryString, function(err,data)
 {
  response = new Object();
  if (err) 
  {
    res.json({application:appName,success:"false",message:"ServerError",data:response});
    return;
  }
  if(data.length>0)
  {
    console.log(data[0].id_user);
    queryString = "INSERT INTO tickets SET id_event='"+id_event+"',id_local='"+id_local+"',"
    queryString+= "id_user_buy='"+data[0].id_user+"',"
    queryString+= "id_user_sold='"+id_user_sold+"',identifier_ticket='"+identifier_ticket+"',"
    queryString+= "date_sold='"+date_sold+"',ticket_type='"+type+"',city_ticket_sold='"+city_ticket_sold+"',"
    queryString+= "number_of_tickets="+num_of_tickets+";";

    connection.query(queryString,function(err,data) 
    {
      if(err)
      {
        res.json({application:appName,success:"false",message:"ServerError",data:response});
        return;
      }
      else
      {
        res.json({application:appName,success:"true",message:"",data:response}); 
      }

    });
  }    
  else
      {
        res.json({application:appName,success:"false",message:"",data:response}); 
      }
});
});

//---------------------------------------------
// 24 - Download_diffusion_list (id_user,   date_last_update)
// Please change UPDATE per DONWNLOAD
//---------------------------------------------
//In this webservice, communicate with "group_list", "group_list_user" and as a reponse we will get json ,
//in case of success is true then updated successfully else not.
app.get('/update_diffusion_list/:id_user/:date_last_update', function(req, res) {
  res.type('application/json');
  var id_user=req.params.id_user;
  var date_last_update = date_last_update;

  queryString = "SELECT group_list.* ";
  queryString += "FROM group_list, group_list_user ";
  queryString += "WHERE group_list_user.id_user='"+id_user+"' and group_list.id_group_list=group_list_user.id_group_list and group_list.date_update>='"+date_last_update+"'";

  connection.query(queryString, function(err,data) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.length > 0)
    {
      var list = [];
      for(var i=0;i<data.length;i++)
      {
        var obj = new Object();
        obj.title_list = data[i].title;
        obj.id_list = data[i].id_group_list;
        obj.number_users = data[i].number_user;

        list.push(obj);
      }
      var today = new Date();
      var dd = today.getDate();
      var mm = today.getMonth()+1; //January is 0!

      var yyyy = today.getFullYear();
      if(dd<10){
        dd='0'+dd
      } 
      if(mm<10){
        mm='0'+mm
      } 
      var date = yyyy+'-'+mm+'-'+dd;

      queryString = "Update group_list SET group_list.date_update='"+date+"'";
      queryString += "WHERE group_list_user.id_user='"+id_user+"' and group_list.id_group_list=group_list_user.id_group_list";
      connection.query(queryString, function(err,data) {
        if (err) 
        {
          res.json({application:appName,success:"false",message:"ServerError",data:response});
          return;
        }
        res.json({application:appName,success:"true",message:"",data:list}); 
      });
    }
    else{
      res.json({application:appName,success:"false",message:"",data:response}); 
    }

  });

});

//---------------------------------------------
// 25 - Delete_diffusion_list   (id_list)
//---------------------------------------------
//In this webservice, communicate with "group_list", as a response,
// we will get json and in case of success is true , deleted successfully else not.  
app.get('/delete_diffusion_list/:id_list', function(req, res) {
  res.type('application/json');
  var id_list=req.params.id_list;

  queryString = "DELETE FROM group_list WHERE id_group_list='"+id_list+"'";

  connection.query(queryString, function(err,data) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.affectedRows > 0)
    {
      res.json({application:appName,success:"true",message:"",data:response});
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }
  });
});

//---------------------------------------------
// 26 -  Create_diffusion_list (id_list,title)
// set too the field of type to diferentiate to the group... I'm very surprised finding this kind of errors... 
//---------------------------------------------
//In this webservice, communicate with "group_list", as a response we will get json and 
//in case of success is true , created successfully else not.  
app.get('/create_diffusion_list/:title/:type', function(req, res) {
  res.type('application/json');
  var title=req.params.title;
  var type=req.params.type;

  queryString = "INSERT INTO group_list SET title='"+title+"', type='"+type+"'";

  connection.query(queryString, function(err,data) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    
    if(data.affectedRows > 0)
    {
      res.json({application:appName,success:"true",message:"",data:response});
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }
  });
});

//---------------------------------------------
// 27 - Update_user_diffusion_list (id_list, id_user, NEW/KO)
//---------------------------------------------
//In this webservice, communicate with "group_list", as a response, 
//we will get json and in case of success is true updated successfully and in case delete,it delete user_diffusion_list  .  
app.get('/update_user_diffusion_list/:id_list/:id_user/:new_or_delete', function(req, res) {
  res.type('application/json');

  var id_list = req.params.id_list;
  var id_user = req.params.id_user;
  var new_or_delete = req.params.new_or_delete;
  if(new_or_delete === "1")
  {
    queryString = "INSERT INTO group_list_user SET id_group_list="+id_list+", id_user="+id_user;
  }
  else
  {
    queryString = "DELETE FROM group_list_user WHERE id_group_list="+id_list+" and id_user="+id_user;
  }
  connection.query(queryString, function(err,data) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.affectedRows > 0)
    {
      res.json({application:appName,success:"true",message:"",data:response});
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }

  });

});

//---------------------------------------------
// 28 - Search_User (text)
// this function is to search a user to add later to the list, no? then, why we give the id_list?.. i think the webservice is not correct, no?
//---------------------------------------------
//In this webserivce, communicate with "user_profile" and as a reponse it will give us json , 
//in case of success is true , we will get data list of users in "data" node in other case empty
app.get('/search_user/:text', function(req, res) {
  res.type('application/json');
  var text=req.params.text;
  var id_list =  req.params.id_list;
  queryString = "SELECT id_user, name, image FROM user_profile ";
  queryString+= "WHERE name LIKE '%"+text+"%';";

  connection.query(queryString, function(err, data, fields) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }

    if(data.length>0)
    {
      var list = []; 
      for(var i=0;i<data.length;i++)
      {
        var obj = new Object();
        obj.id_user = data[i].id_user;
        obj.name = data[i].name;
        obj.icon = data[i].image;
        list.push(obj);
      }
      res.json({application:appName,success:"true",message:"",data:list});
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }
  });
});

//---------------------------------------------
// 29 - Send_image (image, id_user_sender, id_user_receive)
// The image will be scalled on the mobile?
// we need to add a parameter on the webservice... if the image is send it through a group or not.
//---------------------------------------------

// merged with 18

// app.get('/send_image/:image/:id_user_sender/:id_user_receive', function(req, res) {
//   res.type('application/json');
//   var image=req.params.image;
//   var id_user_sender=req.params.id_user_sender;
//   var id_user_receive=req.params.id_user_receive;
  
//     queryString = "INSERT INTO message SET image='"+image+"', id_user_send='"+id_user_sender+"', id_user_receive='"+id_user_receive+"'";
    
//     connection.query(queryString, function(err,data) {
//       response = new Object();
//       if (err) 
//       {
//         res.json({application:appName,success:"false",message:"ServerError",data:response});
//         return;
//       }
//       if(data.affectedRows > 0)
//       {
//         response.message = "Image Sent Successfully";
//         res.json({application:appName,success:"true",message:"",data:response});
//       }
//       else
//       {
//         response.message = "Error Occurred";
//         res.json({application:appName,success:"true",message:"",data:response});
//       }
//     });
//   });

//---------------------------------------------
// 30 - Update_user_list(date_last_update, id_user)
// we need to add the parameter of id_user
//---------------------------------------------
//In this webservice, communicate with "groups_users","user_profile","group_user", as a response, we will get json and in case of success is true , we will get updated list in node "data"
app.get('/update_user_list/:date_last_update/:id_user', function(req, res) {
  res.type('application/json');

  var date_last_update = req.params.date_last_update;
  var id_user = req.params.id_user;

  queryString = "SELECT groups_users.*, user_profile.* ";
  queryString += "FROM groups_users, user_profile, group_user ";
  queryString += "WHERE  groups_users.id_group=group_user.id_group and group_user.id_user=user_profile.id_user and groups_users.date_update>='"+date_last_update+"' and user_profile.id_user='"+id_user+"'";

  connection.query(queryString, function(err,data) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.length > 0)
    {
      var list = [];
      for(var i=0;i<data.length;i++)
      {
       var obj = new Object();
       obj.id_user = data[i].id_user;
       obj.status = data[i].status;
       obj.name = data[i].name;
       obj.mail = data[i].mail;
       obj.sex = data[i].sex;
       obj.age = data[i].age;
       obj.image = data[i].image;
       obj.category = data[i].category;
       list.push(obj);
     }

     var today = new Date();
      var dd = today.getDate();
      var mm = today.getMonth()+1; //January is 0!

      var yyyy = today.getFullYear();
      if(dd<10){
        dd='0'+dd
      } 
      if(mm<10){
        mm='0'+mm
      } 
      var date = yyyy+'-'+mm+'-'+dd;

      queryString = "Update groups_users SET date_update='"+date+"'";
      queryString += "WHERE id_user_admin='"+id_user+"'";
      connection.query(queryString, function(err,data) {
        if (err) 
        {
          res.json({application:appName,success:"false",message:"ServerError",data:response});
          return;
        }
        res.json({application:appName,success:"true",message:"",data:list}); 
      });
   }
   else
   {
    res.json({application:appName,success:"false",message:"",data:response});
  }

});

});

//---------------------------------------------
// 31 - Create_new_user(name,mail,category)
// we dont know the id_group... we just know the id_user_admin... change it...
// if we add through Fb, we dont know the email.. we only know the fb_id
//---------------------------------------------

// if we know the fb_id then mail will be sent empty and if we know the mail then fb_id will be empty
// by the way if we can get fb_id then we can also get email of user, fb allows this thing. but it would also work
//In this webservice, communicate with "user_profile" and as response get json, in case of success is true means created successfully. 
app.get('/create_new_user/:name/:mail/:fb_id/:category/:id_user_admin', function(req, res) {
  res.type('application/json');

  var name = req.params.name;
  var mail = req.params.mail;
  var fb_id = req.params.fb_id;
  var category = req.params.category;
  var id_user_admin = req.params.id_user_admin;

  queryString = "SELECT id_user from user_profile WHERE mail='"+mail+"' or fb_id='"+fb_id+"'";
  connection.query(queryString, function(err,data) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    var id_user;
    if(data.length>0)
    {
      id_user = data[0].id_user;
      queryString = "INSERT INTO group_user SET id_user="+id_user+", id_group=(SELECT id_group FROM groups_users WHERE id_user_admin='"+id_user_admin+"'  and category='"+category+"')";

      connection.query(queryString, function(err,data) {
        if (err) 
        {
          res.json({application:appName,success:"false",message:"ServerError",data:response});
          return;
        }
        res.json({application:appName,success:"true",message:"",data:response});
      });
    }
    else
    {
      queryString = "INSERT INTO user_profile SET mail='"+mail+"', name='"+name+"', fb_id='"+fb_id+"'";

      connection.query(queryString, function(err,data) {
        if (err) 
        {
          res.json({application:appName,success:"false",message:"ServerError",data:response});
          return;
        }
        if(data.affectedRows > 0)
        {
          id_user = data.insertId;
          queryString = "INSERT INTO group_user SET id_user="+id_user+", id_group=(SELECT id_group FROM groups_users WHERE id_user_admin='"+id_user_admin+"' and category='"+category+"')";

          connection.query(queryString, function(err,data) {
            if (err) 
            {
              res.json({application:appName,success:"false",message:"ServerError",data:response});
              return;
            }
            res.json({application:appName,success:"true",message:"",data:response});
          });
        }

      });
    }

  });
});

//---------------------------------------------
// 32 - Delete_user(id_group,id_user)
// the same as the webservice 31.. we dont know id_group
//---------------------------------------------

// we could know the group_id, when we load the groups, we can save group_id at backend
//In this webservice, communicate with "group_user" and we get response in json form , in case of success is true (delete user successfully).  
app.get('/delete_user/:id_group/:id_user', function(req, res) {
  res.type('application/json');

  var id_user = req.params.id_user;
  var id_group = req.params.id_group;
  queryString = "DELETE FROM group_user WHERE id_group="+id_group+" and id_user="+id_user;

  connection.query(queryString, function(err,data) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.affectedRows > 0)
    {
      res.json({application:appName,success:"true",message:"",data:response});
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }
    
  });

});

//---------------------------------------------
// 33 - Modify_user(id_user,name,mail,category )
// the email or the Fb_id, we couldnt change it...
//---------------------------------------------

// we could know the group_id, when we load the groups, we can save group_id at backend
// and we select the user from loaded group
//In this webservice , communicate with "user_profile" and we get response in json form , 
//in case of success is true , it means user modify successfully else not.
app.get('/modify_user/:id_user/:category/:name/:mail', function(req, res) {
  res.type('application/json');

  var name = req.params.name;
  var mail = req.params.mail;
  var id_user = req.params.id_user;
  var category = req.params.category;

  queryString = "UPDATE user_profile SET mail='"+mail+"', name='"+name+"' WHERE id_user='"+id_user+"'";

  connection.query(queryString, function(err,data) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.affectedRows > 0)
    {
      res.json({application:appName,success:"true",message:"",data:response});
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }
  });

});

//---------------------------------------------
// 34 - Check_statistics_users(id_local,id_event)
//---------------------------------------------
//In this webserivce, communicate with "user_profile","tickets" and response in json form , 
//in case of success is true , we will get list data , which has complete statistics object.
app.get('/check_statistics_users/:id_local/:id_event', function(req, res) {
  res.type('application/json');

  var id_local = req.params.id_local;
  var id_event = req.params.id_event;

  queryString = "SELECT tickets.number_of_tickets, user_profile.id_user,user_profile.name,user_profile.image ";
  queryString += "FROM tickets, user_profile ";
  queryString += "WHERE tickets.id_user_buy=user_profile.id_user and tickets.id_local="+id_local+" and tickets.id_event="+id_event;

  connection.query(queryString, function(err,data) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.length > 0)
    {
      var list = [];
      for(var i=0;i<data.length;i++)
      {
       var obj = new Object();
       obj.id_user = data[i].id_user;
       obj.name = data[i].name;
       obj.image = data[i].image;
       obj.number_of_tickets = data[i].number_of_tickets;
       list.push(obj);
     }
     res.json({application:appName,success:"true",message:"",data:list});
   }
   else
   {
    res.json({application:appName,success:"false",message:"",data:response});
  }

});

});

//---------------------------------------------
// 35-  My_events(id_local)
//---------------------------------------------
//In this webserivce, communicate with "local" and "event" and we get response in form of json ,
// in case of success is true , we will get list of events of specific local in "data" node.
app.get('/my_locals/:id_local', function(req, res) {
  res.type('application/json');
  var id_local=req.params.id_local;
  queryString = "SELECT local.*, event.* FROM local, event where event.id_local=local.id_local";

  connection.query(queryString, function(err, data, fields) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.length>0)
    {
      var list = []; 
      for(var i=0;i<data.length;i++)
      {
        var obj = new Object();
        obj.id_local = data[i].id_local;
        obj.id_event = data[i].id_event;
        obj.title = data[i].title;
        obj.date_start = data[i].date_start;
        obj.date_end = data[i].date_end;
        obj.name = data[i].name;
        obj.city_adress = data[i].city_adress;
        obj.telephone = data[i].telephone;
        obj.latitude = data[i].latitude;
        obj.longitude = data[i].longitude;
        obj.telephone = data[i].telephone;
        obj.details = data[i].details;
        obj.cc_number = data[i].cc_number;
        obj.cif_identifier = data[i].cif_identifier;

        list.push(obj);
      }
      res.json({application:appName,success:"true",message:"",data:list});
   }
   else
   {
    res.json({application:appName,success:"false",message:"",data:response});
  }
  });
});

//---------------------------------------------
// 36- New_event(id_local, title_event, date_start, adress, etc.)
// E8- PROBABLY IS INTERESTING TO RETURN THE EVENT ID TO SEND UPLOAD THE IMAGE IN PARALLEL --- Did you make this webservice?
//---------------------------------------------

//In this web-service, communicate with "event" and we get response in json form , 
//in case of success is true, it means new event added successfully else not.
app.get('/add_new_event/:id_local/:title/:date_start/:date_end/:detail/:ticket_cost/:vip_cost', function(req, res) {
  res.type('application/json');

  var id_local = req.params.id_local;
  var title = req.params.title;
  var date_start = req.params.date_start;
  var date_end = req.params.date_end;
  var detail = req.params.detail;
  var ticket_cost = req.params.ticket_cost;
  var vip_cost = req.params.vip_cost;

  queryString = "INSERT INTO event SET id_local='"+id_local+"',title='"+title+"',date_start='"+date_start+"',date_end='"+date_end+"',detail='"+detail+"',ticket_cost='"+ticket_cost+"',vip_cost='"+vip_cost+"'";

  connection.query(queryString, function(err,data) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.affectedRows > 0)
    {
      response.id_event = data.insertId;
      res.json({application:appName,success:"true",message:"",data:response});
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }
  });

});

//---------------------------------------------
//37: Delete Event
//---------------------------------------------
//In this webserivce, we communicate with "event" and we get json response,in this response if node success is true , it means event deleted successfully else not. 
app.get('/deleteEvent/:event_id/:local_id', function(req, res) {
  res.type('application/json');

  var event_id = req.params.event_id;
  var local_id = req.params.local_id;


  queryString = "DELETE FROM event where id_event='"+event_id+"' and id_local='"+local_id+"'";

  connection.query(queryString, function(err,data) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.affectedRows > 0)
    {
      res.json({application:appName,success:"true",message:"",data:response});
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }

  });

});

//---------------------------------------------
// 38-  My_locals(id_user)
//---------------------------------------------
//In this web-service, communicate with "local" and "event" and we get json response, in case of success is true, we can get list of locals of a specific user from "data" node.
app.get('/my_locals/:id_user', function(req, res) {
  res.type('application/json');
  var id_user=req.params.id_user;
  queryString = "SELECT local.*, event.* FROM local, event where event.id_local=local.id_local and local.id_user_admin='"+id_user+"'";

  connection.query(queryString, function(err, data, fields) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.length>0)
    {
      var list = []; 
      for(var i=0;i<data.length;i++)
      {
        var obj = new Object();
        obj.id_local = data[i].id_local;
        obj.id_event = data[i].id_event;
        obj.title = data[i].title;
        obj.date_start = data[i].date_start;
        obj.date_end = data[i].date_end;
        obj.name = data[i].name;
        obj.city_adress = data[i].city_adress;
        obj.telephone = data[i].telephone;
        obj.latitude = data[i].latitude;
        obj.longitude = data[i].longitude;
        obj.telephone = data[i].telephone;
        obj.details = data[i].details;
        obj.cc_number = data[i].cc_number;
        obj.cif_identifier = data[i].cif_identifier;

        list.push(obj);
      }
      res.json({application:appName,success:"true",message:"",data:list});
   }
   else
   {
    res.json({application:appName,success:"false",message:"",data:response});
    }
  });
});

//---------------------------------------------
//39: Add New Local
// E9- PROBABLY IS INTERESTING TO RETURN THE LOCAL ID TO SEND UPLOAD THE IMAGE IN PARALLEL -- Please make this webservice..
//---------------------------------------------
//In this webserivce, communicate with "local" and we get json response, in case of success node is true then it means new local is added successfully.
app.get('/add_new_local/:latitude/:longitude/:name/:cif_identifier/:cc_number/:city_adress/:city/:telephone/:id_user_admin/:detail', function(req, res) {
  res.type('application/json');

  var latitude = req.params.latitude;
  var longitude = req.params.longitude;
  var name = req.params.name;
  var cif_identifier = req.params.cif_identifier;
  var cc_number = req.params.cc_number;
  var city_adress = req.params.city_adress;
  var city = req.params.city;
  var telephone = req.params.telephone;
  var id_user_admin = req.params.id_user_admin;
  var detail = req.params.detail;

  queryString = "INSERT INTO local SET latitude='"+latitude+"',longitude='"+longitude+"',name='"+name+"',cif_identifier='"+cif_identifier+"',cc_number='"+cc_number+"',city_adress='"+city_adress+"',city='"+city+"',telephone='"+telephone+"',id_user_admin='"+id_user_admin+"',details='"+detail+"'";

  connection.query(queryString, function(err,data) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.affectedRows > 0)
    {
      response.id_local = data.insertId;
      res.json({application:appName,success:"true",message:"",data:response});
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }
  });


});   

//---------------------------------------------
//40: Delete Local
// Why you update the local???
//---------------------------------------------
//In this web-service, communicate with "local" and we get json response ,
// in case of success node is true , it means local deleted successfully.
app.get('/delete_local/:id_local', function(req, res) {
  res.type('application/json');

  var id_local = req.params.id_local;
  response = new Object();

  queryString = "SELECT id_local FROM local WHERE id_user_admin=(SELECT id_user_admin FROM local where id_local='"+id_local+"')";

  connection.query(queryString, function(err,data) {
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.length == 1)
    {
      queryString = "UPDATE user_profile SET role=2 where id_user='"+data[0].id_user_admin+"'";

      connection.query(queryString, function(err,data) {
        if (err) 
        {
          res.json({application:appName,success:"false",message:"ServerError",data:response});
          return;
        }
      });
    }

  });

  queryString = "DELETE FROM local where id_local='"+id_local+"'";

  connection.query(queryString, function(err,data) {
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.affectedRows > 0)
    {
      res.json({application:appName,success:"true",message:"",data:response});
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }
  });

});

//------------------------------------------
// It MISS the webservice to upload the image to the event
//------------------------------------------
// Base64Image
//In this webserivce, communicate with "event_local_image" and get response in json form 
//in case of success node is true, image of event uploaded successfully.  
app.get('/upload_event_image/:id_event/:image', function(req, res) {
  res.type('application/json');

  var id_event = req.params.id_event;
  var image = req.params.image;

  queryString = "INSERT INTO event_local_image SET event_id='"+id_event+"', image='"+image+"'";

  connection.query(queryString, function(err,data) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    res.json({application:appName,success:"true",message:"",data:response});
  });


});

// also with post methd

// app.post('/upload', function(req, res){
//   //console.log("Received file:\n" + JSON.stringify(req.files));
  
//   var photoDir = __dirname+"/photos/";
//   var thumbnailsDir = __dirname+"/photos/thumbnails/";
//   var photoName = req.files.source.name;

//   fs.rename(
//     req.files.source.path,
//     photoDir+photoName,
//     function(err){
//       if(err != null){
//         console.log(err)
//         res.send({error:"Server Writting No Good"});
//       } else {
//         im.resize(
//           {
//             srcData:fs.readFileSync(photoDir+photoName, 'binary'),
//             width:256
//           }, 
//           function(err, stdout, stderr){
//             if(err != null){
//               console.log('stdout : '+stdout)
              
//               res.send({error:"Resizeing No Good"});
//             } else {
//               //console.log('ELSE stdout : '+stdout)
//               fs.writeFileSync(thumbnailsDir+"thumb_"+photoName, stdout, 'binary');
//               res.send("Ok");
//             }
//           }
//         );
//       }
//     }
//   );
// });


//------------------------------------------
// It MISS the webservice to uplad the image to the local
//------------------------------------------
// Base64Image
//In this webserivce, communicate with "event_local_image" and get response in json form 
//in case of success node is true, image of local uploaded successfully.  

app.get('/upload_local_image/:id_local/:image', function(req, res) {
  res.type('application/json');

  var id_local = req.params.id_local;
  var image = req.params.image;

  queryString = "INSERT INTO event_local_image SET local_id='"+id_local+"', image='"+image+"'";

  connection.query(queryString, function(err,data) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    res.json({application:appName,success:"true",message:"",data:response});
  });


});
//---------------------------------------------
//41.1 - check_list_group_info (id_list)
//---------------------------------------------
//In this webserivce, communicate with "group_list" and get response in json form 
//in case of success node is true , we will get group_list info from "data" node.

app.get('/check_list_group_info/:id_list', function(req, res) {
  res.type('application/json');
  var id_list=req.params.id_list;
  queryString = "SELECT * FROM group_list where id_group_list='"+id_list+"'";

  connection.query(queryString, function(err, data, fields) {
    response = new Object();
    if (err) 
    {
      res.json({application:appName,success:"false",message:"ServerError",data:response});
      return;
    }
    if(data.length>0)
    {
      var obj = new Object();
      obj.type = data[0].type;
      obj.title_list = data[0].title;
      obj.number_user = data[0].number_user;

      res.json({application:appName,success:"true",message:"",data:obj});
    }
    else
    {
      res.json({application:appName,success:"false",message:"",data:response});
    }
  });
});



//---------------------------------------------
//41.2 - Send_message_group  (id_list, id_user_sender, text)
// In this webservice it miss the message and the push notification to all the users of the group.
//---------------------------------------------

//text is the message
// date is set deafult in database for current time.
//In this webserivce, communicate with "group_list_user" and get response in json form 
//in case of success node is true, message send to group successfully

app.get('/send_message_group/:id_list/:id_user_sender/:text/:image', function(req, res) {
  res.type('application/json');
  var id_list=req.params.id_list;
  var id_user_sender=req.params.id_user_sender;
  var text=req.params.text;
  var image=req.params.image;

    queryString = "SELECT id_user FROM group_list_user WHERE id_group_list='"+id_list+"'";
    
    connection.query(queryString, function(err,data) {
      response = new Object();
      if (err) 
      {
        res.json({application:appName,success:"false",message:"ServerError",data:response});
        return;
      }
      if(data.length > 0)
      {
        for (var i = 0; i  < data.length; i++) {

            queryString = "INSERT INTO message SET image='"+image+"', message_text='"+text+"', id_user_send='"+id_user_sender+"', id_user_receive='"+data[i].id_user+"', id_group_list='"+id_list+"'";
    
            connection.query(queryString, function(err,data) {
              if (err) 
              {
                res.json({application:appName,success:"false",message:"ServerError",data:response});
                return;
              }
            });
        }
        res.json({application:appName,success:"true",message:"",data:response});

      }
      else
      {
        res.json({application:appName,success:"false",message:"",data:response});
      }
    });
  });


app.listen(process.env.PORT || 3000);