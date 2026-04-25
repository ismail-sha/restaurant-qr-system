const db = require('./database');

const migrate = async () => {
  console.log('🔄 Running database migrations...');

  try {
    // Tables
    await db.query(`
      CREATE TABLE IF NOT EXISTS tables (
        id SERIAL PRIMARY KEY,
        table_number INTEGER UNIQUE NOT NULL,
        name VARCHAR(50),
        capacity INTEGER DEFAULT 4,
        is_active BOOLEAN DEFAULT true,
        qr_code TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Categories
    await db.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Menu items
    await db.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        image_url TEXT,
        emoji VARCHAR(10) DEFAULT '🍽️',
        prep_time_minutes INTEGER DEFAULT 15,
        is_available BOOLEAN DEFAULT true,
        is_vegetarian BOOLEAN DEFAULT false,
        is_vegan BOOLEAN DEFAULT false,
        spice_level INTEGER DEFAULT 0 CHECK (spice_level >= 0 AND spice_level <= 3),
        allergens TEXT[],
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Orders
    await db.query(`
      CREATE TYPE IF NOT EXISTS order_status AS ENUM (
        'pending', 'confirmed', 'cooking', 'ready', 'served', 'cancelled'
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(20) UNIQUE NOT NULL,
        table_id INTEGER REFERENCES tables(id),
        status order_status DEFAULT 'pending',
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        notes TEXT,
        estimated_time_minutes INTEGER,
        placed_at TIMESTAMP DEFAULT NOW(),
        confirmed_at TIMESTAMP,
        cooking_started_at TIMESTAMP,
        ready_at TIMESTAMP,
        served_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        cancellation_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Order items
    await db.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        menu_item_id INTEGER REFERENCES menu_items(id),
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL,
        special_instructions TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Staff / Kitchen users
    await db.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(200) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'kitchen',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Order status history (audit log)
    await db.query(`
      CREATE TABLE IF NOT EXISTS order_status_history (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        from_status order_status,
        to_status order_status NOT NULL,
        changed_by INTEGER REFERENCES staff(id),
        note TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Indexes
    await db.query(`CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);`);

    console.log('✅ All migrations completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
};

migrate();
