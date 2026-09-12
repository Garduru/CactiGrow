import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Farm' },
  { to: '/nursery', label: 'Nursery' },
  { to: '/breeding', label: 'Breeding' },
  { to: '/collection', label: 'Collection' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/shop', label: 'Shop' },
  { to: '/marketplace', label: 'Marketplace' },
]

export function GameNav() {
  return (
    <nav>
      {links.map((link) => (
        <NavLink key={link.to} to={link.to}>
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}