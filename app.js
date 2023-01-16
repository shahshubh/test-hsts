// create a new express app boilerplate with a single route that responds with "Hello World!"
const express = require('express');
const { default: helmet } = require('helmet');
const app = express();

app.use(helmet.hsts({
    maxAge: 31536000,
    includeSubDomains: true,
}));

app.get('/', (req, res) => {
    res.send('Hello World!');
    }
);

// listen on port which is to be deployed
app.listen(process.env.PORT || 3000, () => {
    console.log('Listening on port 3000');
});

