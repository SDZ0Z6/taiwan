/* Where each itinerary item sits on the map, matched to data.js by day id + item title.
   geo: [lat, lon], or a hotel id ('H1' 新丽 · 'H2' 路境 · 'H3' 玉玺).
   via: how you get there from the previous stop (walk | car | mrt | hsr | fly);
        left out = guessed from distance.
   from / to: the day starts or ends at that hotel without its own item.
   flyIn / flyOut: draw the flight from or to Kuala Lumpur. */
window.PLACES = {
  hotels: {
    H1: { geo: [25.0463, 121.5057], short: '新丽酒店' },
    H2: { geo: [22.9938, 120.1990], short: '路境行旅' },
    H3: { geo: [25.1160, 121.5262], short: '玉玺饭店' }
  },
  days: {
    d1: { flyIn: true, icon: 'plane', items: {
      '抵达桃园机场第一航厦': { geo: [25.0797, 121.2342], via: 'fly' },
      '入住新丽酒店': { geo: 'H1', via: 'car' },
      '第一顿宵夜': { geo: [25.0476, 121.5066] }
    } },
    d2: { from: 'H1', to: 'H1', toVia: 'car', icon: 'tower101', items: {
      '民乐旗鱼米粉': { geo: [25.0566, 121.5101], via: 'car' },
      '霞海城隍庙 · 拜月老': { geo: [25.0557, 121.5100], via: 'walk' },
      '迪化街慢慢逛': { geo: [25.0603, 121.5099], via: 'walk' },
      '民生社区 · 富锦街': { geo: [25.0592, 121.5613], via: 'car' },
      '象山步道 · 看夕阳': { geo: [25.0272, 121.5762], via: 'car' },
      '鼎泰丰 · 台北101店': { geo: [25.0336, 121.5646], via: 'walk' },
      '升级选项：Smith & Wollensky': { geo: [25.0346, 121.5668] },
      'Bar Mood 吧沐': { geo: [25.0414, 121.5492], via: 'car' }
    } },
    d3: { from: 'H1', icon: 'skylantern', items: {
      '十分老街 · 放天灯': { geo: [25.0413, 121.7752], via: 'car' },
      '十分瀑布': { geo: [25.0479, 121.7873], via: 'walk' },
      '九份老街边走边吃': { geo: [25.1097, 121.8448], via: 'car' },
      '水心月茶坊 · 喝茶等日落': { geo: [25.1093, 121.8424], via: 'walk' },
      '竖崎路 · 阿妹茶楼的灯笼': { geo: [25.1082, 121.8441], via: 'walk' },
      '饶河夜市': { geo: [25.0510, 121.5774], via: 'car' },
      '回酒店': { geo: 'H1', via: 'mrt' },
      'HANKO 60': { geo: [25.0453, 121.5059] }
    } },
    d4: { to: 'H2', toVia: 'walk', icon: 'train', items: {
      '退房，行李寄放酒店': { geo: 'H1' },
      '阜杭豆浆': { geo: [25.0443, 121.5251], via: 'mrt' },
      '华山1914文创园区': { geo: [25.0441, 121.5294], via: 'walk' },
      '回酒店拿行李 → 台北车站': { geo: [25.0478, 121.5170], via: 'car' },
      '高铁 → 台南': { geo: [22.9250, 120.2857], via: 'hsr' },
      '入住路境行旅': { geo: 'H2', via: 'car' },
      '林百货': { geo: [22.9918, 120.2028], via: 'walk' },
      '阿村第二代牛肉汤': { geo: [22.9877, 120.1985], via: 'walk' },
      '赤崁楼夜游': { geo: [22.9975, 120.2025], via: 'car' },
      '神农街': { geo: [22.9973, 120.1962], via: 'walk' },
      'TCRC 前科累累俱乐部': { geo: [22.9966, 120.1991], via: 'walk' }
    } },
    d5: { from: 'H2', to: 'H2', toVia: 'car', icon: 'boat', items: {
      '国华街 · 永乐市场早午餐巡礼': { geo: [22.9963, 120.1977], via: 'walk' },
      '正兴街 · 蜷尾家': { geo: [22.9926, 120.1969], via: 'walk' },
      '回酒店午休': { geo: 'H2', via: 'walk' },
      '四草绿色隧道 · 竹筏': { geo: [23.0195, 120.1368], via: 'car' },
      '安平树屋 · 德记洋行': { geo: [23.0026, 120.1592], via: 'car' },
      '安平老街': { geo: [23.0012, 120.1615], via: 'walk' },
      '安平港边看夕阳': { geo: [22.9975, 120.1553], via: 'walk' },
      '武圣夜市': { geo: [23.0018, 120.1868], via: 'car' },
      'Moonrock': { geo: [23.0005, 120.2045] }
    } },
    d6: { from: 'H2', icon: 'cake', items: {
      '西罗殿牛肉汤': { geo: [23.0006, 120.2068], via: 'car' },
      '孔庙 · 府中街': { geo: [22.9906, 120.2045], via: 'car' },
      '窄门咖啡': { geo: [22.9899, 120.2039], via: 'walk' },
      '大天后宫 · 拜月老': { geo: [22.9970, 120.2018], via: 'car' },
      '回酒店休息，换上好看的衣服': { geo: 'H2', via: 'walk' },
      '奇美博物馆': { geo: [22.9343, 120.2264], via: 'car' },
      '渔光岛看夕阳': { geo: [22.9790, 120.1556], via: 'car' },
      '予岛 YuDao · 生日晚餐': { geo: [22.9808, 120.1570], via: 'walk' },
      '回酒店': { geo: 'H2', via: 'car' },
      'The Han-Jia': { geo: [22.9807, 120.1990] }
    } },
    d7: { from: 'H2', icon: 'hotspring', items: {
      '阿堂咸粥': { geo: [22.9785, 120.1995], via: 'car' },
      '退房': { geo: 'H2', via: 'car' },
      'Uber 去台南高铁站': { geo: [22.9250, 120.2857], via: 'car' },
      '高铁 → 台北': { geo: [25.0478, 121.5170], via: 'hsr' },
      '台北车站 → 天母放行李': { geo: 'H3', via: 'car' },
      '淡水老街': { geo: [25.1697, 121.4405], via: 'car' },
      '红毛城': { geo: [25.1754, 121.4329] },
      '淡水河边看夕阳': { geo: [25.1688, 121.4383], via: 'walk' },
      '少帅禅园 · 私人汤屋 + 圣诞晚餐': { geo: [25.1378, 121.5105], via: 'mrt' },
      '回天母': { geo: 'H3', via: 'car' }
    } },
    d8: { flyOut: true, icon: 'plane', items: {
      '退房': { geo: 'H3' },
      '抵达第一航厦': { geo: [25.0797, 121.2342], via: 'car' }
    } }
  }
};
