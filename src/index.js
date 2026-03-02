const { createApp } = require('./app');
const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
});
