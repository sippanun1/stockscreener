import { Navbar, NavbarBrand } from "flowbite-react";

import goodtradeLogo from "../assets/goodtrade.svg";



export default function MenuHeader() {
  return (
    <Navbar className="px-4 sm:px-6 lg:px-[53px] !bg-[#000000]">
      <NavbarBrand href="/">
        <img
          src={goodtradeLogo}
          className="w-16 h-16 sm:w-20 sm:h-20 lg:w-[97px] lg:h-[97px]"
        />
      </NavbarBrand>

    </Navbar>
  );
}
