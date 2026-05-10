<?php
require 'config.php';

$pdo = db();
$stmt = $pdo->query("SELECT * FROM products");
$products = $stmt->fetchAll();
?>

<h1>Products</h1>

<?php if (empty($products)): ?>
    <p>No products found.</p>
<?php else: ?>
    <?php foreach ($products as $p): ?>
        <div style="border:1px solid #ccc; padding:10px; margin:10px;">
            <h3><?= htmlspecialchars($p['name']) ?></h3>
            <p>₱<?= number_format($p['price'], 2) ?></p>
            <p><?= htmlspecialchars($p['description']) ?></p>
        </div>
    <?php endforeach; ?>
<?php endif; ?>