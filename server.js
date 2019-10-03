const express = require('express');
const express_handlebars = require('express-handlebars');

const mongoose = require('mongoose');

const axios = require('axios');

const cheerio = require('cheerio');

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoHeadlines";

const Article = mongoose.model("Article", new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true,
        unique: true
    },
    byline: {
        type: String,
        required: false
    },
    text: {
        type: String,
        required: false
    }
}));

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const handlebars = express_handlebars();

app.engine('handlebars', handlebars);
app.set('view engine', 'handlebars');

mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
mongoose.set('useUnifiedTopology', true);

const NEWS_SITE = 'https://www.economist.com';

mongoose.connect(MONGODB_URI, (err) => {
    if (err) throw err;
    app.get('/', async (req, res) => {
        const home = await axios.get(NEWS_SITE);
        const $ = cheerio.load(home.data);
        const articles = [];
        $('.teaser__link').each((i, link) => {
            articles.push({
                title: $(link).find('.flytitle-and-title__title').text(),
                url: $(link).attr('href')
            });
        });
        const promises = articles.map(article => axios.get(NEWS_SITE + article.url));
        const pages = await Promise.all(promises);
        pages.forEach((page, i) => {
            const $ = cheerio.load(page.data);
            let text = '';
            $('.blog-post__text').children('p').each((i, paragraph) =>
                text += $(paragraph).text() + '<br>')
            articles[i].text = text;
        });
        await Article.insertMany(articles, { ordered: false }).catch(err => console.log(err));
        const results = await Article.find();
        res.render('index', { articles: results, news: NEWS_SITE });
    });
    app.listen(process.env.PORT || 8080, () => console.log('Listening'));
});

