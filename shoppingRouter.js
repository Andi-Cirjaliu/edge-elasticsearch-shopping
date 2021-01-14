const express = require('express');
const controller = require('./shoppingController');

const router = express.Router();

router.get('/', controller.getShopppingList);
// router.get('/shopping', controller.getShopppingList);

router.post('/shopping', controller.addShopppingItem);

router.post('/shopping/dec', controller.decQtyShopppingItem);
// router.put('/shopping/:item/dec', controller.decQtyShopppingItem);

router.post('/shopping/inc', controller.incQtyShopppingItem);
// router.put('/shopping/:item/inc', controller.incQtyShopppingItem);

router.post('/shopping/rm', controller.deleteShopppingItem);
// router.delete('/shopping/:item', controller.deleteShopppingItem);

module.exports = router;