const db = require('./database');
const bcrypt = require('bcryptjs');

const seed = async () => {
  console.log('🌱 Seeding database...');

  try {
    // Tables
    const tableNumbers = [1,2,3,4,5,6,7,8,9,10];
    for (const num of tableNumbers) {
      await db.query(
        `INSERT INTO tables (table_number, name, capacity) VALUES ($1, $2, $3) ON CONFLICT (table_number) DO NOTHING`,
        [num, `Table ${num}`, num <= 2 ? 2 : num <= 6 ? 4 : 6]
      );
    }
    console.log('✅ Tables seeded');

    // Categories
    const categories = [
      { name: 'Starters', description: 'Light bites to begin', sort_order: 1 },
      { name: 'Mains', description: 'Hearty main courses', sort_order: 2 },
      { name: 'Breads', description: 'Fresh from the tandoor', sort_order: 3 },
      { name: 'Desserts', description: 'Sweet endings', sort_order: 4 },
      { name: 'Drinks', description: 'Refreshing beverages', sort_order: 5 },
    ];

    const catIds = {};
    for (const cat of categories) {
      const res = await db.query(
        `INSERT INTO categories (name, description, sort_order) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING RETURNING id, name`,
        [cat.name, cat.description, cat.sort_order]
      );
      if (res.rows.length) catIds[cat.name] = res.rows[0].id;
    }
    console.log('✅ Categories seeded');

    // Re-fetch category IDs if they already existed
    const catRes = await db.query(`SELECT id, name FROM categories`);
    catRes.rows.forEach(r => catIds[r.name] = r.id);

    // Menu items
    const menuItems = [
      { cat: 'Starters', name: 'Paneer Tikka', desc: 'Grilled cottage cheese with mint chutney and onions', price: 220, emoji: '🧀', prep: 12, veg: true, spice: 1 },
      { cat: 'Starters', name: 'Samosa (2 pcs)', desc: 'Crispy pastry with spiced potato and pea filling', price: 80, emoji: '🥟', prep: 6, veg: true, spice: 1 },
      { cat: 'Starters', name: 'Chicken 65', desc: 'Deep-fried chicken with South Indian spices', price: 250, emoji: '🍗', prep: 15, veg: false, spice: 3 },
      { cat: 'Starters', name: 'Veg Spring Rolls (4 pcs)', desc: 'Crispy rolls with mixed vegetables', price: 150, emoji: '🌯', prep: 10, veg: true, spice: 0 },
      { cat: 'Mains', name: 'Butter Chicken', desc: 'Tender chicken in rich, creamy tomato gravy', price: 280, emoji: '🍛', prep: 18, veg: false, spice: 1 },
      { cat: 'Mains', name: 'Biryani', desc: 'Fragrant basmati rice with spiced meat or vegetables', price: 320, emoji: '🍚', prep: 25, veg: false, spice: 2 },
      { cat: 'Mains', name: 'Dal Makhani', desc: 'Slow-cooked black lentils in butter and cream', price: 180, emoji: '🫘', prep: 15, veg: true, spice: 1 },
      { cat: 'Mains', name: 'Palak Paneer', desc: 'Cottage cheese cubes in spiced spinach gravy', price: 200, emoji: '🌿', prep: 15, veg: true, spice: 1 },
      { cat: 'Mains', name: 'Fish Curry', desc: 'Coastal spices, coconut milk, fresh fish', price: 300, emoji: '🐟', prep: 20, veg: false, spice: 2 },
      { cat: 'Mains', name: 'Lamb Rogan Josh', desc: 'Slow-cooked lamb in Kashmiri spiced gravy', price: 360, emoji: '🍖', prep: 30, veg: false, spice: 2 },
      { cat: 'Breads', name: 'Garlic Naan', desc: 'Tandoor-baked flatbread with garlic butter', price: 60, emoji: '🫓', prep: 8, veg: true, spice: 0 },
      { cat: 'Breads', name: 'Butter Roti', desc: 'Whole wheat flatbread with butter', price: 40, emoji: '🥙', prep: 5, veg: true, spice: 0 },
      { cat: 'Breads', name: 'Paratha', desc: 'Layered flaky bread, plain or stuffed', price: 70, emoji: '🥞', prep: 8, veg: true, spice: 0 },
      { cat: 'Desserts', name: 'Gulab Jamun', desc: 'Soft dumplings soaked in rose-flavored syrup', price: 110, emoji: '🍮', prep: 5, veg: true, spice: 0 },
      { cat: 'Desserts', name: 'Kulfi', desc: 'Traditional Indian ice cream with pistachios', price: 130, emoji: '🍦', prep: 3, veg: true, spice: 0 },
      { cat: 'Drinks', name: 'Mango Lassi', desc: 'Fresh mango blended with yogurt and cardamom', price: 90, emoji: '🥭', prep: 4, veg: true, spice: 0 },
      { cat: 'Drinks', name: 'Masala Chai', desc: 'Spiced tea with ginger, cardamom and milk', price: 40, emoji: '☕', prep: 4, veg: true, spice: 0 },
      { cat: 'Drinks', name: 'Fresh Lime Soda', desc: 'Freshly squeezed lime with sparkling water', price: 60, emoji: '🍋', prep: 3, veg: true, spice: 0 },
    ];

    for (const item of menuItems) {
      await db.query(
        `INSERT INTO menu_items (category_id, name, description, price, emoji, prep_time_minutes, is_vegetarian, spice_level, is_available)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, true) ON CONFLICT DO NOTHING`,
        [catIds[item.cat], item.name, item.desc, item.price, item.emoji, item.prep, item.veg, item.spice]
      );
    }
    console.log('✅ Menu items seeded');

    // Staff
    const passwordHash = await bcrypt.hash('kitchen123', 10);
    await db.query(
      `INSERT INTO staff (name, email, password_hash, role) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      ['Head Chef', 'kitchen@restaurant.com', passwordHash, 'kitchen']
    );
    const adminHash = await bcrypt.hash('admin123', 10);
    await db.query(
      `INSERT INTO staff (name, email, password_hash, role) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      ['Admin', 'admin@restaurant.com', adminHash, 'admin']
    );
    console.log('✅ Staff seeded');
    console.log('\n📋 Login credentials:');
    console.log('   Kitchen: kitchen@restaurant.com / kitchen123');
    console.log('   Admin:   admin@restaurant.com / admin123');
    console.log('\n✅ Database seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
};

seed();
