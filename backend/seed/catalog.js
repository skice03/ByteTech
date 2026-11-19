// A1 demonstration catalog: 34 products in five categories. Prices are in RON.
// Descriptions are original text written for ByteTech. Images are original SVG
// illustrations served by the React app from frontend/public/images/products/.

const product = (slug, name, price, stockQuantity, description) => ({
  slug, name, price, stockQuantity, description,
  images: [{ url: `/images/products/${slug}.svg`, altText: `Illustration of the ${name}` }]
});

export const catalog = [
  {
    name: 'Laptops',
    products: [
      product('ultrabook-14', '14" Ultrabook, 16 GB RAM, 512 GB SSD', '4299.00', 12,
        'A thin aluminium laptop that weighs about 1.3 kg and lasts a full working day on one charge. The 14-inch matte display stays readable near a window, and the backlit keyboard has comfortable key travel for long writing sessions.'),
      product('gaming-laptop-16', '16" Gaming Laptop, 165 Hz, 32 GB RAM, 1 TB SSD', '7899.00', 5,
        'Built for current games at high settings, with a fast 165 Hz screen and a cooling system that keeps the keyboard area cool under load. Plenty of memory and storage leave room for a large game library and streaming software.'),
      product('everyday-laptop-15', '15.6" Everyday Laptop, 8 GB RAM, 256 GB SSD', '2199.99', 25,
        'A dependable laptop for browsing, online classes, documents and video calls. It starts quickly from its SSD, includes a full-size keyboard with a number pad, and offers both USB-A and USB-C ports.'),
      product('convertible-13', '13.3" 2-in-1 Convertible with Stylus', '3599.00', 8,
        'The touch screen folds all the way back, so the same device works as a laptop, a tablet or a stand for presentations. The included stylus is handy for handwritten notes, sketches and signing documents.'),
      product('creator-laptop-16', '16" Creator Laptop, OLED, 32 GB RAM, 2 TB SSD', '9499.00', 3,
        'An OLED panel with deep blacks and wide colour coverage makes this laptop suitable for photo and video editing. It pairs a powerful processor with a 2 TB SSD for large project files.'),
      product('business-laptop-14', '14" Business Laptop, 16 GB RAM, Fingerprint Reader', '4899.00', 0,
        'A durable work laptop with a fingerprint reader, a webcam privacy shutter and a spill-resistant keyboard. Two Thunderbolt-compatible ports connect it to a docking station and external monitors.')
    ]
  },
  {
    name: 'PC Components',
    products: [
      product('cpu-8-core', '8-Core Desktop Processor, up to 4.7 GHz', '1349.00', 20,
        'Eight cores and sixteen threads handle gaming, streaming and multitasking at the same time. The processor supports DDR5 memory and PCIe 5.0, and it runs well with a mid-range tower cooler.'),
      product('cpu-6-core', '6-Core Desktop Processor, up to 4.4 GHz', '799.00', 30,
        'A good-value processor for a first gaming or office build. Six cores deliver smooth everyday performance, and the boxed cooler is enough for normal use.'),
      product('gpu-12gb', '12 GB Graphics Card, Dual Fan', '2899.00', 7,
        'Plays modern titles smoothly at 1440p and speeds up video exports in editing software. Its two fans stop completely at idle, so the card stays silent when you are not gaming.'),
      product('gpu-8gb', '8 GB Graphics Card, Compact', '1599.00', 10,
        'A short graphics card that fits small cases while still offering solid 1080p gaming performance. It needs only one 8-pin power connector.'),
      product('ram-32gb-ddr5', '32 GB (2 × 16 GB) DDR5-6000 Memory Kit', '549.00', 40,
        'A matched pair of memory modules for dual-channel performance. Low-profile heat spreaders clear most large CPU coolers, and an XMP/EXPO profile enables the rated speed in one step.'),
      product('ssd-2tb-nvme', '2 TB NVMe PCIe 4.0 SSD', '699.99', 35,
        'Fast M.2 storage for the operating system, games and large files, with read speeds of up to 7,000 MB/s. A thin heat spreader keeps it cool in laptops and desktops.'),
      product('psu-850w', '850 W 80 PLUS Gold Modular Power Supply', '589.00', 15,
        'Fully modular cables let you connect only what your build needs, which keeps airflow clean. Gold efficiency reduces wasted heat, and the fan stays off at low loads.'),
      product('motherboard-atx', 'ATX Motherboard, DDR5, Wi-Fi 6E', '1099.00', 9,
        'A full-size board with four DDR5 slots, three M.2 sockets and built-in Wi-Fi 6E with Bluetooth. Reinforced PCIe slots and large heatsinks suit high-end graphics cards and processors.'),
      product('case-mid-tower', 'Mid-Tower Case with Tempered Glass Panel', '429.00', 14,
        'A roomy case with a mesh front for good airflow, three pre-installed fans and a tempered glass side panel. Tool-free drive bays and cable channels make building straightforward.')
    ]
  },
  {
    name: 'Monitors',
    products: [
      product('monitor-27-qhd', '27" QHD 165 Hz IPS Monitor', '1499.00', 11,
        'Sharp 2560 × 1440 resolution and a 165 Hz refresh rate suit both work and fast games. The stand adjusts in height, tilt and swivel, and the IPS panel keeps colours consistent from the side.'),
      product('monitor-24-fhd', '24" Full HD 100 Hz IPS Monitor', '649.00', 22,
        'An affordable everyday monitor with thin bezels, an eye-comfort mode and a smooth 100 Hz refresh rate. It works well as a second screen for a laptop.'),
      product('monitor-32-4k', '32" 4K UHD Monitor with USB-C', '2399.00', 6,
        'One USB-C cable carries video, data and 90 W of power to a compatible laptop. The large 4K panel shows detailed spreadsheets, timelines and photos without scaling compromises.'),
      product('monitor-34-ultrawide', '34" Curved Ultrawide Monitor, 144 Hz', '2199.00', 4,
        'The 21:9 curved screen replaces a two-monitor setup and wraps the view around you in games and racing simulators. Picture-by-picture mode shows two computers side by side.'),
      product('monitor-portable-15', '15.6" Portable USB-C Monitor', '899.00', 13,
        'A light second screen that runs from a single USB-C cable and slips into a laptop bag. The folding cover doubles as a stand in portrait or landscape orientation.')
    ]
  },
  {
    name: 'Peripherals',
    products: [
      product('keyboard-mechanical', 'Mechanical Keyboard, Tactile Switches, RGB', '449.00', 26,
        'Tactile switches give clear feedback on every key press, and hot-swap sockets let you change switches without soldering. Per-key lighting and a detachable USB-C cable complete the setup.'),
      product('keyboard-wireless-slim', 'Slim Wireless Keyboard, Multi-Device', '229.00', 30,
        'A quiet low-profile keyboard that pairs with up to three devices and switches between them with one key. It runs for months on two AAA batteries.'),
      product('mouse-ergonomic', 'Ergonomic Wireless Mouse', '189.00', 45,
        'The sculpted shape supports your hand in a natural position during long working days. It connects via Bluetooth or the included USB receiver and charges over USB-C.'),
      product('mouse-gaming', 'Lightweight Gaming Mouse, 26,000 DPI', '279.00', 18,
        'At about 60 grams, this mouse is easy to move quickly and precisely. A high-accuracy optical sensor and low-friction feet help in competitive games.'),
      product('headset-wireless', 'Wireless Headset with Noise-Cancelling Microphone', '499.00', 16,
        'Soft memory-foam ear cushions and a lightweight frame stay comfortable for hours. The flip-to-mute microphone filters background noise for clear calls and team chat.'),
      product('webcam-1080p', '1080p Webcam with Privacy Shutter', '259.00', 21,
        'Full HD video with automatic light correction makes you look clear in video calls. Two built-in microphones pick up your voice, and a sliding shutter covers the lens when it is not in use.'),
      product('speakers-desktop', '2.0 Desktop Speakers, Bluetooth', '319.00', 12,
        'Compact wooden speakers with a warm sound for music, films and games. Connect a computer by cable and a phone over Bluetooth at the same time.'),
      product('usb-c-hub-7in1', '7-in-1 USB-C Hub, 4K HDMI', '169.00', 50,
        'Adds HDMI, three USB-A ports, SD and microSD card readers and pass-through charging to a single USB-C port. The aluminium body is small enough to carry every day.')
    ]
  },
  {
    name: 'Software Licenses',
    products: [
      product('license-os-pro', 'Desktop Operating System, Pro Edition (1 PC)', '899.00', 100,
        'A digital license for the professional edition of a desktop operating system, with disk encryption, remote desktop and business management features. The activation key is delivered by email.'),
      product('license-office-suite', 'Office Suite, 1-Year Subscription for 6 Users', '499.00', 100,
        'Word processing, spreadsheets, presentations and cloud storage for up to six people in one household. Each person signs in with their own account on their own devices.'),
      product('license-internet-security', 'Internet Security, 1 Year, 3 Devices', '149.00', 200,
        'Protects up to three computers or phones against malware and phishing websites. It also includes a password manager and parental controls.'),
      product('license-vpn', 'VPN Service, 2-Year Plan', '299.00', 150,
        'Encrypts your connection on public Wi-Fi networks and supports unlimited bandwidth. One subscription covers up to five simultaneous devices.'),
      product('license-photo-editor', 'Photo Editing Software, Perpetual License', '349.00', 80,
        'Edit RAW photos, remove unwanted objects and retouch portraits with layer-based tools. A perpetual license means no monthly fee.'),
      product('license-cloud-backup', 'Cloud Backup, 1 TB, 1 Year', '199.00', 120,
        'Automatically backs up the files on one computer to encrypted cloud storage. Earlier versions of each file can be restored for up to 30 days.')
    ]
  }
];
