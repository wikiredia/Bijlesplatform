import { Link } from 'react-router-dom';
import { useTitle } from '../components/ui.jsx';

export default function NotFound() {
  useTitle('Pagina niet gevonden');
  return (
    <section className="section page-top"><div className="wrap narrow">
      <h1 className="h1">Deze pagina bestaat niet</h1>
      <p className="lead">Misschien is de link verouderd of zit er een typfout in.</p>
      <Link to="/" className="btn btn-primary">Naar de startpagina</Link>
    </div></section>
  );
}
