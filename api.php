<?php

// api.php  —  Main API Router
require_once 'config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');

$body   = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $body['action'] ?? ($_POST['action'] ?? ($_GET['action'] ?? ''));

switch ($action) {
    case 'register':  handleRegister($body);  break;
    case 'login':     handleLogin($body);     break;
    case 'logout':    handleLogout();         break;
    case 'me':        handleMe();             break;

    case 'get_products':    getProducts();          break;
    case 'get_categories':  getCategories();        break;
    case 'add_product':     addProduct($body);      break;
    case 'edit_product':    editProduct($body);     break;
    case 'delete_product':  deleteProduct($body);   break;
    case 'upload_image':    uploadProductImage();   break;

    case 'place_order':     placeOrder($body);        break;
    case 'get_orders':      getOrders();              break;
    case 'get_all_orders':  getAllOrders();            break;
    case 'update_order':    updateOrderStatus($body); break;

    case 'get_chat':              getChat($body);         break;
    case 'send_chat':             sendChat($body);        break;
    case 'get_all_chats':         getAllChats();           break;
    case 'admin_reply':           adminReply($body);      break;
    case 'check_pending_replies': checkPendingReplies();  break;

    case 'ai_chat': aiChat($body); break;

    default:
        jsonResponse(['error' => 'Unknown action: ' . $action], 400);
}

// ============================================================
// AUTH HANDLERS
// ============================================================

function handleRegister(array $b): void {
    $name      = trim($b['name']  ?? '');
    $email     = trim($b['email'] ?? '');
    $pass      = $b['password']   ?? '';
    $roleInput = $b['role']       ?? 'customer';
    $role      = $roleInput === 'merchant' ? 'admin' : 'customer';

    if (!$name || !$email || !$pass) jsonResponse(['error' => 'All fields required'], 400);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonResponse(['error' => 'Invalid email'], 400);

    $pdo      = db();
    $existing = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $existing->execute([$email]);
    if ($existing->fetch()) jsonResponse(['error' => 'Email already registered'], 409);

    $hash = password_hash($pass, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)");
    $stmt->execute([$name, $email, $hash, $role]);
    $id = (int)$pdo->lastInsertId();

    $_SESSION['user_id'] = $id;
    $_SESSION['name']    = $name;
    $_SESSION['role']    = $role;

    jsonResponse(['success' => true, 'user' => ['id' => $id, 'name' => $name, 'role' => $role]]);
}

function handleLogin(array $b): void {
    $email = trim($b['email']    ?? '');
    $pass  = $b['password'] ?? '';
    if (!$email || !$pass) jsonResponse(['error' => 'Email and password required'], 400);

    $stmt = db()->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($pass, $user['password'])) {
        jsonResponse(['error' => 'Invalid email or password'], 401);
    }

    $_SESSION['user_id'] = $user['id'];
    $_SESSION['name']    = $user['name'];
    $_SESSION['role']    = $user['role'];

    jsonResponse(['success' => true, 'user' => [
        'id'   => $user['id'],
        'name' => $user['name'],
        'role' => $user['role'],
    ]]);
}

function handleLogout(): void {
    session_destroy();
    jsonResponse(['success' => true]);
}

function handleMe(): void {
    if (!isLoggedIn()) jsonResponse(['user' => null]);
    jsonResponse(['user' => [
        'id'   => currentUserId(),
        'name' => $_SESSION['name'],
        'role' => $_SESSION['role'],
    ]]);
}

// ============================================================
// PRODUCT HANDLERS
// ============================================================

function getProducts(): void {
    $cat = $_GET['category'] ?? '';
    $q   = $_GET['search']   ?? '';
    
    $isMerchant = isset($_SESSION['role'])
               && $_SESSION['role'] === 'admin'
               && isset($_GET['admin_view'])
               && isset($_SESSION['user_id']);

    $sql    = "SELECT p.*, c.name AS category FROM products p
               LEFT JOIN categories c ON p.category_id = c.id
               WHERE p.is_active = 1";
    $params = [];

    if ($isMerchant) {
        $sql     .= " AND p.merchant_id = ?";
        $params[] = (int)$_SESSION['user_id'];
    }
    if ($cat) {
        $sql     .= " AND c.name = ?";
        $params[] = $cat;
    }
    if ($q) {
        $sql     .= " AND (p.name LIKE ? OR p.description LIKE ?)";
        $params[] = "%$q%";
        $params[] = "%$q%";
    }
    $sql .= " ORDER BY p.id ASC";

    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    jsonResponse(['products' => $stmt->fetchAll()]);
}

function getCategories(): void {
    $rows = db()->query("SELECT * FROM categories ORDER BY name")->fetchAll();
    jsonResponse(['categories' => $rows]);
}

function addProduct(array $b): void {
    requireAdmin();
    $name  = trim($b['name']         ?? '');
    $desc  = trim($b['description']  ?? '');
    $price = (float)($b['price']     ?? 0);
    $catId = (int)($b['category_id'] ?? 0);
    $image = trim($b['image']        ?? 'placeholder.png');

    if (!$name || !$price || !$catId) jsonResponse(['error' => 'Name, price, and category required'], 400);

    $stmt = db()->prepare("INSERT INTO products (name, description, price, image, category_id, merchant_id) VALUES (?,?,?,?,?,?)");
    $stmt->execute([$name, $desc, $price, $image, $catId, currentUserId()]);
    jsonResponse(['success' => true, 'id' => (int)db()->lastInsertId()]);
}

function editProduct(array $b): void {
    requireAdmin();
    $id    = (int)($b['id']          ?? 0);
    $name  = trim($b['name']         ?? '');
    $desc  = trim($b['description']  ?? '');
    $price = (float)($b['price']     ?? 0);
    $catId = (int)($b['category_id'] ?? 0);
    $image = trim($b['image']        ?? '');

    if (!$id || !$name) jsonResponse(['error' => 'Missing fields'], 400);

    // Check ownership
    $check = db()->prepare("SELECT merchant_id FROM products WHERE id = ?");
    $check->execute([$id]);
    $product = $check->fetch();
    if (!$product || (int)$product['merchant_id'] !== currentUserId()) {
        jsonResponse(['error' => 'You can only edit your own products'], 403);
        return;
    }

    $stmt = db()->prepare("UPDATE products SET name=?,description=?,price=?,category_id=?,image=? WHERE id=?");
    $stmt->execute([$name, $desc, $price, $catId, $image, $id]);
    jsonResponse(['success' => true]);
}

function deleteProduct(array $b): void {
    requireAdmin();
    $id = (int)($b['id'] ?? 0);

    // Check ownership
    $check = db()->prepare("SELECT merchant_id FROM products WHERE id = ?");
    $check->execute([$id]);
    $product = $check->fetch();
    if (!$product || (int)$product['merchant_id'] !== currentUserId()) {
        jsonResponse(['error' => 'You can only delete your own products'], 403);
        return;
    }

    db()->prepare("UPDATE products SET is_active=0 WHERE id=?")->execute([$id]);
    jsonResponse(['success' => true]);
}

function uploadProductImage(): void {
    requireAdmin();

    if (empty($_FILES['image'])) jsonResponse(['error' => 'No file received'], 400);

    $file = $_FILES['image'];
    if ($file['error'] !== UPLOAD_ERR_OK) jsonResponse(['error' => 'Upload error code: ' . $file['error']], 400);

    $ext     = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    if (!in_array($ext, $allowed)) jsonResponse(['error' => 'Invalid file type: ' . $ext], 400);
    if ($file['size'] > 5 * 1024 * 1024) jsonResponse(['error' => 'File too large (max 5MB)'], 400);

    if (!is_dir(UPLOAD_DIR)) mkdir(UPLOAD_DIR, 0755, true);

    $filename = uniqid('prod_') . '.' . $ext;
    $dest     = UPLOAD_DIR . $filename;

    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        jsonResponse(['error' => 'Failed to save file. Check folder permissions: ' . UPLOAD_DIR], 500);
    }

    jsonResponse(['success' => true, 'filename' => $filename, 'url' => UPLOAD_URL . $filename]);
}

// ============================================================
// ORDER HANDLERS
// ============================================================

function placeOrder(array $b): void {
    requireLogin();
    $items = $b['items'] ?? [];
    $notes = trim($b['notes'] ?? '');
    if (empty($items)) jsonResponse(['error' => 'Cart is empty'], 400);

    $pdo   = db();
    $total = 0;
    foreach ($items as $item) $total += (float)$item['price'] * (int)$item['qty'];

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO orders (user_id, total, notes) VALUES (?,?,?)");
        $stmt->execute([currentUserId(), $total, $notes]);
        $orderId = (int)$pdo->lastInsertId();

        $iStmt = $pdo->prepare("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?,?,?,?)");
        foreach ($items as $item) {
            $iStmt->execute([$orderId, (int)$item['id'], (int)$item['qty'], (float)$item['price']]);
        }
        $pdo->commit();
        jsonResponse(['success' => true, 'order_id' => $orderId]);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(['error' => 'Order failed: ' . $e->getMessage()], 500);
    }
}

function getOrders(): void {
    requireLogin();
    $stmt = db()->prepare("
        SELECT o.*, GROUP_CONCAT(CONCAT(p.name,' x',oi.quantity) SEPARATOR ' · ') AS items_summary
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.user_id = ?
        GROUP BY o.id
        ORDER BY o.created_at DESC
    ");
    $stmt->execute([currentUserId()]);
    jsonResponse(['orders' => $stmt->fetchAll()]);
}

function getAllOrders(): void {
    requireAdmin();
    $stmt = db()->prepare("
        SELECT o.*, u.name AS customer_name,
               GROUP_CONCAT(CONCAT(p.name,' x',oi.quantity) SEPARATOR ' · ') AS items_summary
        FROM orders o
        JOIN users u ON o.user_id = u.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.product_id IN (
            SELECT id FROM products WHERE merchant_id = ?
        )
        GROUP BY o.id
        ORDER BY o.created_at DESC
    ");
    $stmt->execute([currentUserId()]);
    jsonResponse(['orders' => $stmt->fetchAll()]);
}

function updateOrderStatus(array $b): void {
    requireAdmin();
    $id     = (int)($b['id']     ?? 0);
    $status = $b['status'] ?? '';
    $valid  = ['pending', 'preparing', 'completed', 'cancelled'];
    if (!$id || !in_array($status, $valid)) jsonResponse(['error' => 'Invalid data'], 400);

    $check = db()->prepare("
        SELECT COUNT(*) FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ? AND p.merchant_id = ?
    ");
    $check->execute([$id, currentUserId()]);
    if ((int)$check->fetchColumn() === 0) {
        jsonResponse(['error' => 'You can only update orders containing your products'], 403);
        return;
    }

    db()->prepare("UPDATE orders SET status=? WHERE id=?")->execute([$status, $id]);
    jsonResponse(['success' => true]);
}

// ============================================================
// CHAT HANDLERS
// ============================================================

function getChat(array $b): void {
    requireLogin();
    $stmt = db()->prepare("SELECT * FROM chat_messages WHERE user_id=? ORDER BY created_at ASC");
    $stmt->execute([currentUserId()]);
    jsonResponse(['messages' => $stmt->fetchAll()]);
}

function sendChat(array $b): void {
    requireLogin();
    $msg = trim($b['message'] ?? '');
    if (!$msg) jsonResponse(['error' => 'Empty message'], 400);

    $pdo    = db();
    $userId = currentUserId();

    $merchantId = isset($b['merchant_id']) ? (int)$b['merchant_id'] : null;
    $stmt = $pdo->prepare("INSERT INTO chat_messages (user_id, sender, message, merchant_id) VALUES (?,?,?,?)");
    $stmt->execute([$userId, 'customer', $msg, $merchantId]);

    $check = $pdo->prepare("
        SELECT COUNT(*) FROM chat_messages 
        WHERE user_id = ? AND sender = 'store'
        AND created_at > (
            SELECT MAX(created_at) FROM chat_messages 
            WHERE user_id = ? AND sender = 'customer'
        )
    ");
    $check->execute([$userId, $userId]);
    if ((int)$check->fetchColumn() > 0) { jsonResponse(['success' => true]); return; }

    $recentAI = $pdo->prepare("
        SELECT COUNT(*) FROM chat_messages 
        WHERE user_id = ? AND sender = 'ai'
        AND created_at >= NOW() - INTERVAL 2 MINUTE
    ");
    $recentAI->execute([$userId]);
    if ((int)$recentAI->fetchColumn() > 0) { jsonResponse(['success' => true]); return; }

    $autoReply = autoReplyText($msg);
    $stmt->execute([$userId, 'ai', $autoReply, $merchantId]); // ← ADD $merchantId here
    jsonResponse(['success' => true, 'auto_reply' => $autoReply]);
}

function checkPendingReplies(): void {
    $pdo  = db();
    $stmt = $pdo->query("
        SELECT cm.user_id, cm.message, cm.merchant_id
        FROM chat_messages cm
        WHERE cm.sender = 'customer'
        AND cm.created_at <= NOW() - INTERVAL 2 MINUTE
        AND NOT EXISTS (
            SELECT 1 FROM chat_messages 
            WHERE user_id = cm.user_id 
            AND sender IN ('store', 'ai')
            AND created_at > cm.created_at
        )
        AND NOT EXISTS (
            SELECT 1 FROM chat_messages
            WHERE user_id = cm.user_id
            AND sender = 'store'
        )
        GROUP BY cm.user_id
    ");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $row) {
        $autoReply = autoReplyText($row['message']);
        $insert    = $pdo->prepare("INSERT INTO chat_messages (user_id, sender, message, merchant_id) VALUES (?,?,?,?)");
        $insert->execute([$row['user_id'], 'ai', $autoReply, $row['merchant_id']]); 
    }
    jsonResponse(['success' => true]);
}

function autoReplyText(string $q): string {
    $q = strtolower($q);
    if (str_contains($q, 'track') || str_contains($q, 'order'))
        return "You can track your order in the Orders tab. Status updates: Pending → Preparing → Completed! 📦";
    if (str_contains($q, 'deliver') || str_contains($q, 'long'))
        return "Delivery usually takes 20–40 minutes depending on your location. 🛵";
    if (str_contains($q, 'pay') || str_contains($q, 'payment'))
        return "We accept Cash on Delivery, GCash, and card payments. 💳";
    if (str_contains($q, 'cancel'))
        return "Orders can be cancelled within 2 minutes. Please contact us immediately. 🙏";
    if (str_contains($q, 'hello') || str_contains($q, 'hi'))
        return "Hello! 😊 How can we help you today?";
    return "Thanks for reaching out! Our team will respond shortly. For urgent matters, try our AI Assistant.";
}

function getAllChats(): void {
    requireAdmin();
    $stmt = db()->prepare("
        SELECT cm.*, u.name AS user_name
        FROM chat_messages cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.merchant_id = ?
        ORDER BY cm.created_at ASC
    ");
    $stmt->execute([currentUserId()]);
    $rows    = $stmt->fetchAll();
    $grouped = [];
    foreach ($rows as $row) {
        $grouped[$row['user_id']]['user_name']  = $row['user_name'];
        $grouped[$row['user_id']]['messages'][] = $row;
    }
    jsonResponse(['chats' => $grouped]);
}

function adminReply(array $b): void {
    requireAdmin();
    $userId = (int)($b['user_id'] ?? 0);
    $msg    = trim($b['message']  ?? '');
    if (!$userId || !$msg) jsonResponse(['error' => 'Missing data'], 400);
    $stmt = db()->prepare("INSERT INTO chat_messages (user_id, sender, message, merchant_id) VALUES (?,?,?,?)");
    $stmt->execute([$userId, 'store', $msg, currentUserId()]);
    jsonResponse(['success' => true]);
}

// ============================================================
// AI CHAT HANDLER
// ============================================================

function aiChat(array $b): void {
    $message = strtolower(trim($b['message'] ?? ''));

    try {
        $pdo = db();
    } catch (Exception $e) {
        jsonResponse(['reply' => 'DB error: ' . $e->getMessage()]);
        return;
    }

    if (str_contains($message, 'menu') || str_contains($message, 'product')) {
        try {
            $products = $pdo->query("
                SELECT p.name, p.price, c.name AS category 
                FROM products p 
                JOIN categories c ON p.category_id = c.id 
                ORDER BY c.name, p.name
            ")->fetchAll();
        } catch (Exception $e) {
            jsonResponse(['reply' => 'Query error: ' . $e->getMessage()]);
            return;
        }
        if (!$products) { jsonResponse(['reply' => "No products available at the moment."]); return; }
        $grouped = [];
        foreach ($products as $p) {
            $grouped[$p['category']][] = '- ' . $p['name'] . ' - P' . number_format($p['price'], 2);
        }
        $reply = "Our Menu:\n";
        foreach ($grouped as $category => $items) {
            $reply .= "\n>> " . ucfirst($category) . "\n" . implode("\n", $items) . "\n";
        }
        jsonResponse(['reply' => $reply]);
        return;
    }

    if (str_contains($message, 'bestseller') || str_contains($message, 'best seller') || str_contains($message, 'popular')) {
        try {
            $bestsellers = $pdo->query("
                SELECT p.name, COUNT(oi.id) as total
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                GROUP BY oi.product_id
                ORDER BY total DESC
                LIMIT 5
            ")->fetchAll();
        } catch (Exception $e) {
            jsonResponse(['reply' => 'Query error: ' . $e->getMessage()]);
            return;
        }
        if ($bestsellers) {
            $reply = "Our bestsellers:\n\n";
            foreach ($bestsellers as $i => $row) {
                $reply .= ($i + 1) . ". " . $row['name'] . " (" . $row['total'] . " orders)\n";
            }
        } else {
            $reply = "No orders yet but all our products are amazing! Check our menu.";
        }
        jsonResponse(['reply' => $reply]);
        return;
    }

    if (str_contains($message, 'deliver') || str_contains($message, 'how long') || str_contains($message, 'delivery time')) {
        jsonResponse(['reply' => "Delivery takes 20-40 minutes depending on your location."]);
        return;
    }
    if (str_contains($message, 'track') || str_contains($message, 'order')) {
        jsonResponse(['reply' => "You can track your order in the Orders tab. Status updates: Pending -> Preparing -> Completed!"]);
        return;
    }
    if (str_contains($message, 'pay') || str_contains($message, 'payment')) {
        jsonResponse(['reply' => "We accept Cash on Delivery, GCash, and card payments."]);
        return;
    }
    if (str_contains($message, 'cancel')) {
        jsonResponse(['reply' => "Orders can be cancelled within 2 minutes. Please contact us immediately."]);
        return;
    }
    if (str_contains($message, 'hello') || str_contains($message, 'hi') || str_contains($message, 'hey')) {
        jsonResponse(['reply' => "Hello! How can I help you today? You can ask me about our menu, bestsellers, delivery time, or payments."]);
        return;
    }

    jsonResponse(['reply' => "I can help you with:\n- Menu\n- Bestsellers\n- Delivery time\n- Payment methods\n- Order tracking"]);
}
