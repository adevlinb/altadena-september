export function checkApiKey(req, res, next) {
  const apiKey = req.header('x-api-key'); // send it from Google Sheets as a header
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next(); // proceed to next middleware or route handler
}