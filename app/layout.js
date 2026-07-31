import './styles.css';

export const metadata = {
  title: 'Project Ledger',
  description: 'Bill status and payment overview',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
