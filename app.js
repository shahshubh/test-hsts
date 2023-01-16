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

app.listen(3000, () => console.log('Example app listening on port 3000!'));

