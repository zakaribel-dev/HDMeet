-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1
-- Généré le : lun. 15 jan. 2024 à 16:55
-- Version du serveur : 10.4.28-MariaDB
-- Version de PHP : 8.2.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `hdmeet`
--

-- --------------------------------------------------------

--
-- Structure de la table `users`
--

CREATE TABLE `users` (
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(255) NOT NULL,
  `created_At` timestamp(6) NOT NULL DEFAULT current_timestamp(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `users`
--

INSERT INTO `users` (`email`, `password`, `role`, `created_At`) VALUES
('carmela@gmail.com', '$2b$10$V7QT2HMR7Mpq9lKpa8UMduvfrYzvvfwF4ZA/m6bk9VQSB0iuXBOpm', 'USER', '2024-01-13 19:05:34.973083'),
('jennifer@gmail.com', '$2b$10$4NFUsHxxh3LGp78P4COWqOmraEHqnjEd1PRrnEvNy8SHTsRuIYGcC', 'ADMIN', '2024-01-12 10:19:53.151935'),
('quentin@gmail.com', '$2b$10$n.lKHtVT.Arzx1miev.D6O9o3FvorkJxYm4qiEKnM0rD6ZqoEsLz6', 'ADMIN', '2024-01-12 10:30:27.380350'),
('zakaribel@hotmail.com', '$2b$10$kr17ETOTA3udgCzf/QvD2.DGa2F360XYhWM81BZ4dLVHbpyQHhsnm', 'ADMIN', '2024-01-07 11:05:45.426670');

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`email`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
