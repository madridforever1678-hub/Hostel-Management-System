const express=require('express')
const app=express()
const ejs=require('ejs')
const bodyparser=require('body-parser')
const nodemailer=require('nodemailer')
const mongoose=require('mongoose')
const multer=require('multer')
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const pdf = require('html-pdf');
const path = require('path');
const session=require('express-session')
const flash=require('connect-flash')
const { MongoNetworkError } = require('mongodb')
const { defaultMaxListeners } = require('nodemailer/lib/xoauth2')
const { MongoClient } = require('mongodb');
const MongoDBStore = require('connect-mongodb-session')(session);
require('dotenv').config()

app.set('view engine','ejs')
app.use(express.json())
app.use(bodyparser.urlencoded({extended: false}))
app.use(express.static('views')); 

//sessions store
const store = new MongoDBStore({
    uri: process.env.MONGO_URL,
    collection: 'mySessions'
  });
  app.use(session({
      secret: 'your secret',
      resave: true,
      saveUninitialized: false,
      store: store
    }));

  //authenticate sessions
  function isAuthenticated(req, res, next) {
    if (req.session.user) {
      return next();
    }
    res.redirect('/login');
  }

  //flash messages express
  app.use(flash());

// Flash message middleware
app.use((req, res, next) => {
    res.locals.successMessage = req.flash('success');
    res.locals.errorMessage = req.flash('error');
    next();
});

  //mongoose connection
  mongoose
  .connect(process.env.MONGO_URL,{
    useNewUrlParser : true
  }).then(() => console.log("Database connected!"))
  .catch(err => console.log(err));

//object schemas
const admin_schema=mongoose.Schema({
   username: String,
   password:String,
   Designation:String,
   Hostel:String,
   phone:String
})

const student_schema=mongoose.Schema({
  username:String,
  password:String,
  year:String,
  Branch:String,
  Room_no:String,
  Fullname:String,
  phone:String,
  Hostel:String,
  Email:String
})

const complaint_schema=mongoose.Schema({
  user_id:mongoose.Schema.Types.ObjectId,
  room_num:String,
  complaint:String,
  date:Date
})

const mess_schema=mongoose.Schema({
  day:String,
  breakfast:String,
  Lunch:String,
  Dinner:String
})

const notice_schema=mongoose.Schema({
  contentType: String,
  data: String
})

const payment_schema=mongoose.Schema({
   user_id:mongoose.Schema.Types.ObjectId,
   amount:String,
   Fullname:String,
   phone:String,
   Hostel:String,
   year:String,
   Branch:String
})

const resolved_schema=mongoose.Schema({
  user_id:mongoose.Schema.Types.ObjectId,
  admin_id:mongoose.Schema.Types.ObjectId,
  text:String,
  Room:String
})

const order_schema=mongoose.Schema({
  admin_id:mongoose.Schema.Types.ObjectId,
  item:String,
  quantity:String,
  ordered:{
    type: Date,
    default: Date.now
  }
})

const event_schema=mongoose.Schema({
  admin_id:mongoose.Schema.Types.ObjectId,
  name:String,
  description:String,
  Date:Date
})

//creating models
const Student=mongoose.model('Student',student_schema)
const Admin=mongoose.model('Admin',admin_schema)
const Complaints=mongoose.model('Complaints',complaint_schema)
const Mess =mongoose.model('Mess',mess_schema)
const Notice=mongoose.model('Notice',notice_schema)
const Payment=mongoose.model('Payment',payment_schema)
const Resolved=mongoose.model("Resolved",resolved_schema)
const Order=mongoose.model('Order',order_schema)

//multer Configuration
//Memory Storage
// Set storage engine to memory storage

//home route
app.get('/',(req,res)=>{
     res.render('../views/home')
})

//Admin login route
app.get('/admin',function(req,res){
   res.render('../views/login_admin')
})

//Admin complaints view after login
app.post('/admin',async(req,res)=>{
  const name=req.body.username
  const pass=req.body.password
  const user=await Admin.findOne({username:name,password:pass});
    if(user){
        req.session.user = user;
        try {
          const orders = await Order.find().sort({ orderedOn: -1 }); 
          res.render('admin_board', { orders });
          } 
        catch (error) {
          res.status(500).send('Error retrieving orders');
     }
    }
     else{
        res.redirect('/admin')
     }
})

//Student login route
app.get('/student',function(req,res){
   res.render('../views/login_student')
})
app.post('/student',async(req,res)=>{
  const name=req.body.username
  const pass=req.body.password
  const user=await Student.findOne({username:name,password:pass});
    if(user){
        req.session.user = user;
        Notice.find()
     .then(images => {
      res.render('stud_board', { images });
    })
    .catch(err => res.status(500).send(err));
     }
     else{
        res.redirect('/student')
     }
})

app.get('/student/notice',isAuthenticated,(req,res)=>{
  Notice.find()
  .then(images => {
   res.render('stud_board', { images });
 })
 .catch(err => res.status(500).send(err));
})

//student profile route
app.get('/student/profile',isAuthenticated,async(req,res)=>{
   await Student.findOne({_id:req.session.user._id}).then((data)=>{
    res.render('profile',{user:data})
   })
})

//admin profile route
app.get('/admin/profile',isAuthenticated,async(req,res)=>{
  await Admin.findOne({_id:req.session.user._id}).then((data)=>{
    res.render('admin_profile',{user:data})
  })
})

//student complaints route
app.get('/student/complaint',isAuthenticated,async(req,res)=>{
   await Resolved.find({user_id:req.session.user._id}).then((data)=>{
    res.render('complaints',{complaint:data})
   })
})

app.post('/student/complaint',isAuthenticated,async(req,res)=>{
   const com=req.body.complaint
   const id=req.session.user._id
    await Student.findOne({_id:id}).then((data)=>{
      const room=data.Room_no
      const new_com=new Complaints({
        user_id:id,
        complaint:com,
        room_num:room,
      })
      new_com.save()
     res.redirect('/student/complaint')
    })
})

//Admin complaints route
app.get('/admin/complaint',isAuthenticated,async (req,res)=>{
  await Complaints.find().then((data)=>{
    res.render('admin_complaints',{complaint:data})
  })
})

app.post('/admin/complaint',isAuthenticated, async(req,res)=>{
  try {
    const {complaintId}  = req.body
    await Complaints.findOne({_id:complaintId}).then((data)=>{
      const new_res=new Resolved({
        admin_id:req.session.user._id,
        user_id:data.user_id,
        text:data.complaint,
        Room:data.room_num
     })
     new_res.save()
    })
    await Complaints.deleteOne({_id:complaintId})
      res.redirect('/admin/complaint')
  }
  catch (error) {
    console.error('Error resolving complaint:', error);
    res.status(500).json({ message: 'Internal server error' });
}
})

//student payment
app.get('/student/payment',isAuthenticated,(req,res)=>{
  res.render('../views/student_pay')
})

app.post('/student/payment', isAuthenticated,async(req, res) => {

  try {
    const student = await Student.findOne({ _id: req.session.user._id });
    const { fullname, roomNumber, hostel, phone } = req.body;
    if (student) {
      const year = student.year;
      const Branch = student.Branch;
      const fee = 30000;
      const user_id= req.session.user._id
      const new_pay = new Payment({
        user_id:user_id,
        amount: fee,
        Fullname: req.body.fullname,
        phone: req.body.phone,
        Hostel: req.body.hostel,
        year: year,
        Branch: Branch
      });
      await new_pay.save()

    //for sending payment invoice (download)
      const content = {
        user_id:user_id,
        fullname: fullname,
        roomNumber: roomNumber,
        hostel: hostel,
        phone: phone,
        Branch:Branch,
        year:year,
        fee:fee
    }

    //use html-pdf library 

    ejs.renderFile(path.join(__dirname, './views/invoice.ejs'), content, (err, html) => {
      if (err) {
        console.error(err);
        return res.send('An error occurred');
      }
      pdf.create(html).toBuffer((err, buffer) => {
        if (err) {
          console.error(err);
          return res.send('An error occurred');
        }
        
        res.type('pdf');
        res.end(buffer, 'binary');
      });
    });
    }

    else {
      res.status(404).send("Student not found!")
    }
  }

   catch (err) {
    console.error(err);
    res.status(500).send("An error occurred during payment processing!!");
  }
});

//admin view payments
app.get('/admin/payment',isAuthenticated, async(req,res)=> {
  await Payment.find().then((data)=>{
    res.render('admin_payment',{payment:data})
  })
})

//student mess
app.get('/student/mess',isAuthenticated,async(req,res)=>{
  await Mess.find().then((data)=>{
    res.render('../views/student_mess',{messMenus:data})
  })
})

//admin edit mess route
app.get('/admin/mess',isAuthenticated,(req,res)=>{
  res.render('../views/mess')
})

app.post('/admin/mess',isAuthenticated,async(req,res)=>{
  const day=req.body.mealDay
  const type=req.body.mealType
  const new_mess=req.body.menuItems
  if(type=="breakfast"){
    await Mess.updateOne({day:day},
      { $set:
         { breakfast: new_mess }
      })
  }
  else if(type=="lunch"){
    await Mess.updateOne({day:day},
      { $set:
        { Lunch: new_mess }
   })
  }
  else if(type=="dinner"){
    await Mess.updateOne({day:day},
      { $set:
         { Dinner: new_mess }
   })
  }
  res.render('../views/mess',{message:"Updated Successfully!"})
})

//admin search student route
app.get('/admin/view', async (req, res) => {
  try {
      let students = await Student.find({});
      if (req.query.query) {
          const query = req.query.query.toLowerCase();
          students = students.filter(student => {
              return student.Fullname.toLowerCase().includes(query) ||
                     student.Room_no.toLowerCase().includes(query) ||
                     student.phone.toLowerCase().includes(query) ||
                     student.Branch.toLowerCase().includes(query);
          });
      }
      res.render('view_students', { students });
  } catch (error) {
      console.error('Error fetching students:', error);
      res.status(500).send('Internal Server Error');
  }
});

//admin add inventory
app.post('/admin/addinventory',isAuthenticated,async(req,res)=>{
     const new_order=new Order({
        item:req.body.itemName,
        quantity:req.body.itemQuantity,
        ordered:new Date()
     })
     new_order.save();
     res.redirect('/admin/complaint')
})

//admin add notice route
app.get('/admin/notice',isAuthenticated,(req,res)=>{
  res.render('../views/notices')
})

app.post('/admin/notice',upload.single('image'),  isAuthenticated,(req, res) => {
  const imgBase64 = req.file.buffer.toString('base64');
  const imgToStore = {
    data: imgBase64,
    contentType: req.file.mimetype
  };
  const newImage = new Notice(imgToStore);
   newImage.save()
    .then(() => res.render('notices',{message:"Uploaded Successfully"}))
    .catch(err => res.status(500).send(err));
});

//support route
app.get('/support',(req,res)=>{
  res.render('../views/support')
})

app.post('/support',async(req,res)=>{
  const email=req.body.email
  const newone=req.body.password_reset
  try {
      const user = await Student.findOne({ email });
      if (!user) {
          req.flash('error', 'User not found');
          return res.redirect('/support');
      }
      user.password = newone;
      await user.save();
      req.flash('success', 'Password updated successfully!');
      res.redirect('/support');
  } 
  catch (error) {
      req.flash('error', 'Error updating password');
      res.redirect('/support');
  }
})
//contact route
app.get('/contact',(req,res)=>{
  res.render('../views/contact')
})

//Hostel Gallery route
app.get('/gallery',(req,res)=>{
  res.render('../views/gallery')
})

//logout route
app.post('/logout',(req,res)=>{
  req.session.destroy()
  res.redirect('/')
})

//Server & Port
app.listen(3000,function(err){
    if(!err)
        console.log('Server Connected')
    else
        console.log('Error!')
})
